/**
 * Data for the small Backups forms in SystemBackupsView.swift:
 * `SystemBackupCreateView` (create / discover), `SystemVolumeRunView` and
 * `BackupRecoveryKeyView`. Shared by both platforms.
 */
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import type { SystemVolumeBackupOption } from '@/sdk/models/backup/SystemVolumeBackupOption';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import {
	backupRequestScope,
	useAliveRef,
	useBackupSessionScope,
	useEmitOnDismiss,
	useGlobalPermissions
} from './backup-scope';

/** `dismiss()` for the presenting screen. */
export function useDismiss() {
	const navigation = useNavigation();
	return useCallback(() => {
		if (navigation.canGoBack()) navigation.goBack();
	}, [navigation]);
}

/** `.task(id: clientGeneration)` loading `s3Destinations.options()` when allowed. */
function useDestinationOptions(onError: (message: string) => void, enabled = true) {
	const client = useClientManager((s) => s.client);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const permissions = useGlobalPermissions();
	const canList = permissions.has('s3-destinations:list');
	const alive = useAliveRef();
	const [destinations, setDestinations] = useState<S3Destination[]>([]);
	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;
	useEffect(() => {
		if (!enabled || !client || !canList) return;
		const scope = backupRequestScope(() => alive.current);
		client.s3Destinations
			.options()
			.then((result) => {
				scope.check();
				setDestinations(result);
			})
			.catch((error: unknown) => {
				if (!isCancellation(error)) onErrorRef.current(friendlyErrorMessage(error));
			});
	}, [alive, canList, client, clientGeneration, enabled]);
	return destinations;
}

/** `SystemBackupCreateView(discover:)`. */
export function useSystemBackupCreate(discover: boolean) {
	const client = useClientManager((s) => s.client);
	const dismiss = useDismiss();
	const alive = useAliveRef();
	useBackupSessionScope();
	useEmitOnDismiss('history');
	const [destination, setDestination] = useState('local');
	const [s3ID, setS3ID] = useState('');
	const [recoveryKey, setRecoveryKey] = useState('');
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const destinations = useDestinationOptions(setErrorMessage);

	const submit = async () => {
		const scope = backupRequestScope(() => alive.current);
		if (!client) return;
		setBusy(true);
		try {
			if (discover) {
				const count = await client.systemBackups.discover({
					request: { s3DestinationId: s3ID, recoveryKey }
				});
				scope.check();
				showToast(Toasts.info(`Found ${count} backups`));
			} else {
				await client.systemBackups.create({
					request: {
						destination,
						s3DestinationId: destination === 'local' ? undefined : s3ID,
						recoveryKey: recoveryKey === '' ? undefined : recoveryKey
					}
				});
				scope.check();
				showToast(Toasts.info('Backup started. Check history for completion.'));
			}
			setRecoveryKey('');
			dismiss();
		} catch (error) {
			if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (alive.current) setBusy(false);
		}
	};

	return {
		discover,
		title: discover ? 'Discover System Backups' : 'Create Backup',
		confirmTitle: discover ? 'Discover' : 'Create',
		confirmDisabled: busy || ((discover || destination !== 'local') && s3ID === ''),
		destination,
		setDestination,
		s3ID,
		setS3ID,
		recoveryKey,
		setRecoveryKey,
		destinations,
		busy,
		errorMessage,
		submit: () => void submit(),
		cancel: dismiss
	};
}

export type SystemBackupCreateModel = ReturnType<typeof useSystemBackupCreate>;

/** `SystemVolumeRunView`. */
export function useSystemVolumeRun() {
	const client = useClientManager((s) => s.client);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const dismiss = useDismiss();
	const alive = useAliveRef();
	const permissions = useGlobalPermissions();
	const canListDestinations = permissions.has('s3-destinations:list');
	useBackupSessionScope();
	useEmitOnDismiss('history');
	const [destination, setDestination] = useState('local');
	const [s3ID, setS3ID] = useState('');
	const [stopContainers, setStopContainers] = useState(false);
	const [selectionMode, setSelectionMode] = useState('all');
	const [ignoreAnonymous, setIgnoreAnonymous] = useState(true);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [options, setOptions] = useState<SystemVolumeBackupOption[]>([]);
	const [destinations, setDestinations] = useState<S3Destination[]>([]);
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	useEffect(() => {
		if (!client) return;
		const scope = backupRequestScope(() => alive.current);
		void (async () => {
			try {
				const result = await client.systemBackups.volumeOptions();
				scope.check();
				setOptions(result);
				if (canListDestinations) {
					const list = await client.s3Destinations.options();
					scope.check();
					setDestinations(list);
				}
			} catch (error) {
				// Swift reports every failure here, including cancellation.
				if (alive.current) setErrorMessage(friendlyErrorMessage(error));
			}
		})();
	}, [alive, canListDestinations, client, clientGeneration]);

	const toggleVolume = (name: string, isOn: boolean) =>
		setSelected((current) => {
			const next = new Set(current);
			if (isOn) next.add(name);
			else next.delete(name);
			return next;
		});

	const run = async () => {
		const scope = backupRequestScope(() => alive.current);
		if (!client) return;
		setBusy(true);
		try {
			await client.systemBackups.runVolumeBackups({
				request: {
					custom: {
						destination,
						s3DestinationId: destination === 'local' ? undefined : s3ID,
						stopContainers,
						selectionMode,
						volumeNames: [...selected],
						ignoreAnonymous
					}
				}
			});
			scope.check();
			showToast(Toasts.info('Volume backups started. Check history for completion.'));
			dismiss();
		} catch (error) {
			if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (alive.current) setBusy(false);
		}
	};

	return {
		destination,
		setDestination,
		s3ID,
		setS3ID,
		stopContainers,
		setStopContainers,
		selectionMode,
		setSelectionMode,
		ignoreAnonymous,
		setIgnoreAnonymous,
		selected,
		toggleVolume,
		options,
		destinations,
		busy,
		errorMessage,
		runDisabled:
			busy ||
			(destination !== 'local' && s3ID === '') ||
			(selectionMode === 'allowlist' && selected.size === 0),
		run: () => void run(),
		cancel: dismiss
	};
}

export type SystemVolumeRunModel = ReturnType<typeof useSystemVolumeRun>;

export const volumeSelectionOptions = [
	{ label: 'All', value: 'all' },
	{ label: 'Only selected', value: 'allowlist' },
	{ label: 'Except selected', value: 'blocklist' }
];

/** `BackupRecoveryKeyView`. */
export function useBackupRecoveryKey() {
	const client = useClientManager((s) => s.client);
	const alive = useAliveRef();
	useBackupSessionScope();
	const [key, setKey] = useState('');
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string>();

	const generate = async () => {
		const scope = backupRequestScope(() => alive.current);
		if (!client) return;
		setBusy(true);
		try {
			const generated = await client.systemBackups.generateRecoveryKey();
			scope.check();
			setKey(generated.recoveryKey);
			setMessage('Store this key somewhere safe before saving it on the server.');
		} catch (error) {
			if (!isCancellation(error)) setMessage(friendlyErrorMessage(error));
		} finally {
			if (alive.current) setBusy(false);
		}
	};

	const save = async () => {
		const scope = backupRequestScope(() => alive.current);
		if (!client) return;
		setBusy(true);
		try {
			await client.systemBackups.setRecoveryKey({ request: { recoveryKey: key } });
			setKey('');
			scope.check();
			showToast(Toasts.success('Recovery key saved'));
		} catch (error) {
			if (!isCancellation(error)) setMessage(friendlyErrorMessage(error));
		} finally {
			if (alive.current) setBusy(false);
		}
	};

	/**
	 * Swift copies with `.localOnly` and a 60 s expiry. expo-clipboard has no
	 * such options, so the key is cleared after 60 s if it is still on the pasteboard.
	 */
	const copy = () => {
		const copied = key;
		void Clipboard.setStringAsync(copied);
		setTimeout(() => {
			void Clipboard.getStringAsync().then((current) => {
				if (current === copied) void Clipboard.setStringAsync('');
			});
		}, 60_000);
		showToast(Toasts.copied('Recovery key copied'));
	};

	return {
		key,
		setKey,
		busy,
		message,
		generate: () => void generate(),
		save: () => void save(),
		copy
	};
}

export type BackupRecoveryKeyModel = ReturnType<typeof useBackupRecoveryKey>;
