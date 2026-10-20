import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { withCleanup } from '@/core/with-cleanup';
import { passkeyAuthenticatorOptions } from '@/core/auth/auth-session';
import { formatDate } from '@/core/date-formatting';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type {
	MFAStatus,
	PasskeyCapabilities,
	PasskeySummary,
	StepUpGrant
} from '@/sdk/models/auth/Passkey';
import { parseArcaneDate } from '@/sdk/models/base/date';
import { ArcanePasskeyAuthenticator } from '@/sdk/passkeys/ArcanePasskeyAuthenticator';
import { CeremonyError } from '@/sdk/passkeys/CeremonyTypes';
import { useClientManager } from '@/stores/client-manager';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';
import { relativeTimeFormat } from '@/core/relative-time';

type ProtectedAction =
	| { kind: 'add'; name: string | undefined }
	| { kind: 'rename'; passkey: PasskeySummary; name: string }
	| { kind: 'delete'; passkey: PasskeySummary }
	| { kind: 'enableMFA' }
	| { kind: 'disableMFA' }
	| { kind: 'regenerateRecoveryCodes' };

export type RecoveryCodesPayload = { codes: string[] };

const isUserCancellation = (error: unknown) =>
	isCancellation(error) || (error instanceof CeremonyError && error.kind === 'cancelled');

const expiry = (grant: StepUpGrant) => parseArcaneDate(grant.expiresAt)?.getTime() ?? 0;

const makeAuthenticator = (client: ArcaneClient) =>
	new ArcanePasskeyAuthenticator(client, passkeyAuthenticatorOptions);

function relativeNamed(date: Date, now = Date.now()): string {
	const seconds = Math.round((date.getTime() - now) / 1000);
	const format = relativeTimeFormat();
	const abs = Math.abs(seconds);
	if (abs < 60) return format.format(seconds, 'second');
	if (abs < 3_600) return format.format(Math.round(seconds / 60), 'minute');
	if (abs < 86_400) return format.format(Math.round(seconds / 3_600), 'hour');
	if (abs < 604_800) return format.format(Math.round(seconds / 86_400), 'day');
	if (abs < 2_629_800) return format.format(Math.round(seconds / 604_800), 'week');
	if (abs < 31_557_600) return format.format(Math.round(seconds / 2_629_800), 'month');
	return format.format(Math.round(seconds / 31_557_600), 'year');
}

export function passkeyRowDetails(passkey: PasskeySummary) {
	const created = parseArcaneDate(passkey.createdAt);
	const lastUsed = parseArcaneDate(passkey.lastUsedAt);
	return {
		created: created ? formatDate(created, 'abbreviated', 'omitted') : passkey.createdAt,
		lastUsed: lastUsed ? relativeNamed(lastUsed) : undefined
	};
}

async function stepUpWithAuthenticator(
	authenticator: ArcanePasskeyAuthenticator
): Promise<
	{ kind: 'granted'; grant: StepUpGrant } | { kind: 'failed'; message: string | undefined }
> {
	try {
		const grant = await authenticator.stepUp();
		return { kind: 'granted', grant };
	} catch (error) {
		return {
			kind: 'failed',
			message: isUserCancellation(error) ? undefined : friendlyErrorMessage(error)
		};
	}
}

export function usePasskeysMFA() {
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const navigation = useSettingsNavigation();

	const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
	const [capabilities, setCapabilities] = useState<PasskeyCapabilities>();
	const [mfaStatus, setMFAStatus] = useState<MFAStatus>();
	const [isLoading, setIsLoading] = useState(false);
	const [bridgeAvailable, setBridgeAvailable] = useState(false);
	const [stepUpGrant, setStepUpGrantState] = useState<StepUpGrant>();
	const [showsStepUp, setShowsStepUp] = useState(false);
	const [showsAddPrompt, setShowsAddPrompt] = useState(false);
	const [newPasskeyName, setNewPasskeyName] = useState('');
	const [renamingPasskey, setRenamingPasskey] = useState<PasskeySummary>();
	const [renamedPasskeyName, setRenamedPasskeyName] = useState('');
	const [pendingDelete, setPendingDelete] = useState<PasskeySummary>();

	const latest = useRef({ passkeys, capabilities, bridgeAvailable });
	useLayoutEffect(() => {
		latest.current = { passkeys, capabilities, bridgeAvailable };
	});
	const grantRef = useRef<StepUpGrant | undefined>(undefined);
	const queuedAction = useRef<ProtectedAction | undefined>(undefined);
	const passkeyAuthenticator = useRef<ArcanePasskeyAuthenticator | undefined>(undefined);

	const setStepUpGrant = (grant: StepUpGrant | undefined) => {
		grantRef.current = grant;
		setStepUpGrantState(grant);
	};

	const clearStepUp = () => {
		setStepUpGrant(undefined);
		queuedAction.current = undefined;
		setShowsStepUp(false);
	};

	const cancelPasskeyCeremony = () => {
		passkeyAuthenticator.current?.cancel();
		passkeyAuthenticator.current = undefined;
	};

	const load = async () => {
		const { client, clientGeneration: generation } = useClientManager.getState();
		if (!client) return;
		setIsLoading(true);
		await withCleanup(
			async () => {
				const [loadedPasskeys, loadedCapabilities, loadedStatus, loadedBridge] = await Promise.all([
					client.passkeys.list().catch(() => undefined),
					client.passkeys.capabilities().catch(() => undefined),
					client.passkeys.mfaStatus().catch(() => undefined),
					makeAuthenticator(client).isBridgeAvailable()
				]);
				if (generation !== useClientManager.getState().clientGeneration) return;
				setPasskeys(loadedPasskeys ?? []);
				setCapabilities(loadedCapabilities);
				setMFAStatus(loadedStatus);
				setBridgeAvailable(loadedBridge);
			},
			() => setIsLoading(false)
		);
	};

	const validStepUpGrant = () => {
		const grant = grantRef.current;
		return grant && expiry(grant) > Date.now() ? grant : undefined;
	};

	const enrollsWithoutStepUp = (action: ProtectedAction) =>
		action.kind === 'add' &&
		latest.current.capabilities?.canEnrollWithActiveSession === true &&
		latest.current.capabilities.requiresStepUp === false;

	const request = (action: ProtectedAction) => {
		if (enrollsWithoutStepUp(action)) {
			void execute(action, undefined);
			return;
		}
		const grant = validStepUpGrant();
		if (!grant) {
			const { capabilities: caps, bridgeAvailable: bridge, passkeys: list } = latest.current;
			if (!(caps?.hasLocalPassword === true || (bridge && list.length > 0))) {
				showToast(Toasts.info('No step-up authentication method is available'));
				return;
			}
			queuedAction.current = action;
			setShowsStepUp(true);
			return;
		}
		void execute(action, grant);
	};

	const finishStepUp = async (grant: StepUpGrant) => {
		setStepUpGrant(grant);
		setShowsStepUp(false);
		const action = queuedAction.current;
		if (!action) return;
		queuedAction.current = undefined;
		await execute(action, grant);
	};

	const authenticateStepUpWithPassword = async (password: string): Promise<string | undefined> => {
		const client = useClientManager.getState().client;
		if (!client) return 'No server configured';
		let grant: StepUpGrant;
		try {
			grant = await client.passkeys.passwordStepUp({ password });
		} catch (error) {
			return friendlyErrorMessage(error);
		}
		await finishStepUp(grant);
		return undefined;
	};

	const authenticateStepUpWithPasskey = async (): Promise<string | undefined> => {
		const client = useClientManager.getState().client;
		if (!client) return 'No server configured';
		const authenticator = makeAuthenticator(client);
		passkeyAuthenticator.current = authenticator;
		const outcome = await withCleanup(
			() => stepUpWithAuthenticator(authenticator),
			() => {
				if (passkeyAuthenticator.current === authenticator)
					passkeyAuthenticator.current = undefined;
			}
		);
		if (outcome.kind === 'failed') return outcome.message;
		await finishStepUp(outcome.grant);
		return undefined;
	};

	const presentRecoveryCodes = (codes: string[]) => {
		const payload: RecoveryCodesPayload = { codes };
		navigation.push('settings/profile/recovery-codes', { payload: settingsPayloads.put(payload) });
	};

	const execute = async (
		action: ProtectedAction,
		grant: StepUpGrant | undefined
	): Promise<void> => {
		const client = useClientManager.getState().client;
		if (!client) return;
		if (grant && expiry(grant) <= Date.now()) {
			clearStepUp();
			request(action);
			return;
		}
		if (!grant && !enrollsWithoutStepUp(action)) {
			request(action);
			return;
		}
		const generation = useClientManager.getState().clientGeneration;
		setIsLoading(true);
		const stepUpToken = grant?.token;
		await withCleanup(
			async () => {
				try {
					switch (action.kind) {
						case 'add': {
							if (!latest.current.bridgeAvailable) {
								showToast(Toasts.info('This server does not provide the mobile passkey bridge'));
								return;
							}
							const authenticator = makeAuthenticator(client);
							passkeyAuthenticator.current = authenticator;
							await withCleanup(
								async () => {
									await authenticator.register({ name: action.name, stepUpToken });
								},
								() => {
									if (passkeyAuthenticator.current === authenticator)
										passkeyAuthenticator.current = undefined;
								}
							);
							showToast(Toasts.success('Passkey added'));
							break;
						}
						case 'rename':
							if (!stepUpToken) return;
							await client.passkeys.rename({
								id: action.passkey.id,
								name: action.name,
								stepUpToken
							});
							showToast(Toasts.success('Passkey renamed'));
							break;
						case 'delete':
							if (!stepUpToken) return;
							await client.passkeys.delete({ id: action.passkey.id, stepUpToken });
							showToast(Toasts.success('Passkey deleted'));
							break;
						case 'enableMFA': {
							if (!stepUpToken) return;
							const response = await client.passkeys.enableMFA({ stepUpToken });
							presentRecoveryCodes(response.codes);
							showToast(Toasts.success('Multi-factor authentication enabled'));
							break;
						}
						case 'disableMFA':
							if (!stepUpToken) return;
							await client.passkeys.disableMFA({ stepUpToken });
							showToast(Toasts.success('Multi-factor authentication disabled'));
							break;
						case 'regenerateRecoveryCodes': {
							if (!stepUpToken) return;
							const response = await client.passkeys.regenerateRecoveryCodes({ stepUpToken });
							presentRecoveryCodes(response.codes);
							showToast(Toasts.success('Recovery codes regenerated'));
							break;
						}
					}
					if (generation !== useClientManager.getState().clientGeneration) return;
					await load();
				} catch (error) {
					if (isUserCancellation(error)) return;
					if (generation !== useClientManager.getState().clientGeneration) return;
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setIsLoading(false)
		);
	};

	const resetForClient = useEffectEvent(() => {
		cancelPasskeyCeremony();
		clearStepUp();
		void load();
	});
	useEffect(() => {
		resetForClient();
	}, [clientGeneration]);

	const grantExpiresAt = stepUpGrant?.expiresAt;
	const expireStepUp = useEffectEvent((expiresAt: string) => {
		if (grantRef.current?.expiresAt === expiresAt) clearStepUp();
	});
	useEffect(() => {
		if (grantExpiresAt === undefined) return;
		const remaining = (parseArcaneDate(grantExpiresAt)?.getTime() ?? 0) - Date.now();
		const timer = setTimeout(() => expireStepUp(grantExpiresAt), Math.max(remaining, 0));
		return () => clearTimeout(timer);
	}, [grantExpiresAt]);

	const endSessionInBackground = useEffectEvent(() => {
		if (Platform.OS === 'android' && passkeyAuthenticator.current) return;
		cancelPasskeyCeremony();
		clearStepUp();
	});
	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) => {
			if (state === 'background') endSessionInBackground();
		});
		return () => subscription.remove();
	}, []);

	useEffect(() => () => cancelPasskeyCeremony(), []);

	useItemDeleteConfirmation(pendingDelete, setPendingDelete, (passkey) => ({
		title: 'Delete Passkey',
		message: `This removes ${passkey.name} from your Arcane account.`,
		icon: 'trash',
		actions: [{ title: 'Delete', action: () => request({ kind: 'delete', passkey }) }],
		dismissOnConfirm: false
	}));

	const trimmedRename = renamedPasskeyName.trim();

	return {
		passkeys,
		capabilities,
		mfaStatus,
		isLoading,
		bridgeAvailable,
		showsInitialLoading: isLoading && passkeys.length === 0 && mfaStatus === undefined,
		mfaEnabled: mfaStatus?.enabled === true,
		mfaFooter:
			passkeys.length === 0
				? 'Add a passkey before enabling multi-factor authentication.'
				: 'Arcane requires a fresh password or passkey confirmation for security changes.',
		emptyDescription: bridgeAvailable
			? 'Add a passkey for passwordless sign-in and multi-factor authentication.'
			: 'This server does not provide the mobile passkey bridge.',
		addDisabled:
			!bridgeAvailable || capabilities?.canEnrollWithActiveSession === false || isLoading,
		deleteDisabled: passkeys.length === 1 && capabilities?.canDeleteLastPasskey === false,

		refresh: load,

		showsAddPrompt,
		newPasskeyName,
		setNewPasskeyName,
		beginAdd: () => {
			setNewPasskeyName('');
			setShowsAddPrompt(true);
		},
		dismissAddPrompt: () => setShowsAddPrompt(false),
		confirmAdd: () => {
			setShowsAddPrompt(false);
			const name = newPasskeyName.trim();
			request({ kind: 'add', name: name === '' ? undefined : name });
		},

		renamingPasskey,
		renamedPasskeyName,
		setRenamedPasskeyName,
		renameDisabled: trimmedRename === '',
		beginRename: (passkey: PasskeySummary) => {
			setRenamedPasskeyName(passkey.name);
			setRenamingPasskey(passkey);
		},
		cancelRename: () => setRenamingPasskey(undefined),
		confirmRename: () => {
			const passkey = renamingPasskey;
			if (!passkey) return;
			setRenamingPasskey(undefined);
			request({ kind: 'rename', passkey, name: trimmedRename });
		},

		requestDelete: setPendingDelete,
		enableMFA: () => request({ kind: 'enableMFA' }),
		disableMFA: () => request({ kind: 'disableMFA' }),
		regenerateRecoveryCodes: () => request({ kind: 'regenerateRecoveryCodes' }),

		showsStepUp,
		stepUpAllowsPassword: capabilities?.hasLocalPassword === true,
		stepUpAllowsPasskey: bridgeAvailable && passkeys.length > 0,
		authenticateStepUpWithPassword,
		authenticateStepUpWithPasskey,
		cancelStepUp: () => {
			queuedAction.current = undefined;
			setShowsStepUp(false);
		},
		stepUpDismissed: () => setShowsStepUp(false)
	};
}

export type PasskeysMFAModel = ReturnType<typeof usePasskeysMFA>;
