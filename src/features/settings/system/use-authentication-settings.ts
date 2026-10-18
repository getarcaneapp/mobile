import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { withCleanup } from '@/core/with-cleanup';
import { friendlyErrorMessage } from '@/core/errors';
import { useCachedClient } from '@/core/networking/use-cached-client';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { PublicSetting } from '@/sdk/models/settings/Settings';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { swiftInt } from '@/ui/components/settings-form.types';

export const AuthenticationSettingsValidation = {
	sessionTimeoutMinutes: { lowerBound: 15, upperBound: 525_600 },

	sessionTimeoutError(rawValue: string): string | undefined {
		const minutes = swiftInt(rawValue.trim());
		const { lowerBound, upperBound } = AuthenticationSettingsValidation.sessionTimeoutMinutes;
		if (minutes === undefined || minutes < lowerBound || minutes > upperBound) {
			return 'Session Timeout must be a whole number between 15 and 525600 minutes.';
		}
		return undefined;
	}
} as const;

export const passwordPolicyOptions = [
	{ label: 'Basic', value: 'basic' },
	{ label: 'Standard', value: 'standard' },
	{ label: 'Strong', value: 'strong' }
];

export type AuthenticationForm = {
	authLocalEnabled: boolean;
	authSessionTimeout: string;
	authPasswordPolicy: string;
	oidcEnabled: boolean;
	oidcProviderName: string;
	oidcIssuerUrl: string;
	oidcClientId: string;
	oidcClientSecret: string;
	oidcScopes: string;
	oidcGroupsClaim: string;
	oidcSkipTlsVerify: boolean;
	oidcAutoRedirectToProvider: boolean;
	oidcMergeAccounts: boolean;
	oidcProviderLogoUrl: string;
};

const initialForm: AuthenticationForm = {
	authLocalEnabled: true,
	authSessionTimeout: '1440',
	authPasswordPolicy: 'strong',
	oidcEnabled: false,
	oidcProviderName: '',
	oidcIssuerUrl: '',
	oidcClientId: '',
	oidcClientSecret: '',
	oidcScopes: 'openid email profile',
	oidcGroupsClaim: '',
	oidcSkipTlsVerify: false,
	oidcAutoRedirectToProvider: false,
	oidcMergeAccounts: false,
	oidcProviderLogoUrl: ''
};

function formFromSettings(dict: Record<string, string>): AuthenticationForm {
	const isTrue = (key: string) => dict[key]?.toLowerCase() === 'true';
	return {
		authLocalEnabled: isTrue('authLocalEnabled'),
		authSessionTimeout: dict.authSessionTimeout ?? '1440',
		authPasswordPolicy: dict.authPasswordPolicy ?? 'strong',
		oidcEnabled: isTrue('oidcEnabled'),
		oidcProviderName: dict.oidcProviderName ?? '',
		oidcIssuerUrl: dict.oidcIssuerUrl ?? '',
		oidcClientId: dict.oidcClientId ?? '',
		oidcClientSecret: dict.oidcClientSecret ?? '',
		oidcScopes: dict.oidcScopes ?? 'openid email profile',
		oidcGroupsClaim: dict.oidcGroupsClaim ?? '',
		oidcSkipTlsVerify: isTrue('oidcSkipTlsVerify'),
		oidcAutoRedirectToProvider: isTrue('oidcAutoRedirectToProvider'),
		oidcMergeAccounts: isTrue('oidcMergeAccounts'),
		oidcProviderLogoUrl: dict.oidcProviderLogoUrl ?? ''
	};
}

const formKeys = Object.keys(initialForm) as (keyof AuthenticationForm)[];
const sameForm = (lhs: AuthenticationForm, rhs: AuthenticationForm) =>
	formKeys.every((key) => lhs[key] === rhs[key]);

async function fetchAuthenticationForm(
	client: ArcaneClient,
	environmentID: EnvironmentID
): Promise<AuthenticationForm> {
	const path = client.rest.environmentPath(environmentID, 'settings');
	const text = await client.transport.rawRequest(path);
	const dtos = client.transport.decode<PublicSetting[]>(text);
	const dict: Record<string, string> = {};
	for (const dto of dtos) dict[dto.key] = dto.value;
	return formFromSettings(dict);
}

export function useAuthenticationSettings() {
	const client = useClientManager((s) => s.client);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const cached = useCachedClient();

	const [form, setForm] = useState<AuthenticationForm>(initialForm);
	const [originalState, setOriginalState] = useState<AuthenticationForm>();
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [oidcEnvForced, setOidcEnvForced] = useState(false);

	const latestForm = useRef(form);
	useLayoutEffect(() => {
		latestForm.current = form;
	});

	const hasChanges = !isLoading && originalState !== undefined && !sameForm(form, originalState);

	const update = useCallback(
		<Key extends keyof AuthenticationForm>(key: Key, value: AuthenticationForm[Key]) => {
			setForm((current) => ({ ...current, [key]: value }));
		},
		[]
	);

	const loadSettings = useCallback(async () => {
		if (!client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		setOriginalState(undefined);
		await withCleanup(
			async () => {
				try {
					const loaded = await fetchAuthenticationForm(client, activeEnvironmentID);
					setForm(loaded);
					try {
						const status = await client.auth.oidcStatus();
						setOidcEnvForced(status.envForced);
					} catch {}
					setOriginalState(loaded);
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsLoading(false)
		);
	}, [client, activeEnvironmentID]);

	useEffect(() => {
		void loadSettings();
	}, [loadSettings]);

	const revertChanges = useCallback(() => {
		if (!originalState) return;
		setForm(originalState);
		setErrorMessage(undefined);
	}, [originalState]);

	const save = useCallback(async () => {
		if (!client) return;
		const current = latestForm.current;
		const validationError = AuthenticationSettingsValidation.sessionTimeoutError(
			current.authSessionTimeout
		);
		if (validationError) {
			setErrorMessage(validationError);
			showToast(Toasts.error(validationError));
			return;
		}

		setIsSaving(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				try {
					const body: Record<string, string> = {
						authLocalEnabled: String(current.authLocalEnabled),
						authPasswordPolicy: current.authPasswordPolicy,
						authSessionTimeout: current.authSessionTimeout,
						oidcEnabled: String(current.oidcEnabled),
						oidcMergeAccounts: String(current.oidcMergeAccounts),
						oidcSkipTlsVerify: String(current.oidcSkipTlsVerify),
						oidcAutoRedirectToProvider: String(current.oidcAutoRedirectToProvider)
					};
					const setIfPresent = (key: keyof AuthenticationForm) => {
						const trimmed = String(current[key]).trim();
						if (trimmed !== '') body[key] = trimmed;
					};
					setIfPresent('oidcClientId');
					setIfPresent('oidcClientSecret');
					setIfPresent('oidcIssuerUrl');
					setIfPresent('oidcScopes');
					setIfPresent('oidcGroupsClaim');
					setIfPresent('oidcProviderName');
					setIfPresent('oidcProviderLogoUrl');

					const path = client.rest.environmentPath(activeEnvironmentID, 'settings');
					await client.rest.put<PublicSetting[]>(path, { body });
					if (cached) cached.invalidate(activeEnvironmentID, [path, `${path}*`]);
					setOriginalState(latestForm.current);
					showToast(Toasts.success('Authentication settings saved'));
				} catch (error) {
					const message = friendlyErrorMessage(error);
					setErrorMessage(message);
					showToast(Toasts.error(message));
				}
			},
			() => setIsSaving(false)
		);
	}, [client, activeEnvironmentID, cached]);

	return {
		form,
		update,
		isLoading,
		isSaving,
		errorMessage,
		oidcEnvForced,
		hasChanges,
		save,
		revertChanges
	};
}
