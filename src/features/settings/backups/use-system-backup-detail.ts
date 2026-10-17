import { useEffect, useState } from 'react';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { formatFileBytes } from '@/core/networking/remote-data-limits';
import { EnvironmentID } from '@/sdk/client/environment';
import type { BackupHistoryEntry } from '@/sdk/models/backup/BackupHistoryEntry';
import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import type { BackupOperation } from './backup-policy-draft';
import { useBackupNavigation } from './backup-routes';
import {
	backupRequestScope,
	useAliveRef,
	useBackupSessionScope,
	useGlobalPermissions
} from './backup-scope';
import { useDismiss } from './use-backup-forms';

export function useSystemBackupDetail(entry: BackupHistoryEntry) {
	const client = useClientManager((s) => s.client);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const permissions = useGlobalPermissions();
	const nav = useBackupNavigation();
	const dismiss = useDismiss();
	const alive = useAliveRef();
	useBackupSessionScope();

	const [recoveryKey, setRecoveryKey] = useState('');
	const [destinations, setDestinations] = useState<S3Destination[]>([]);
	const [destinationID, setDestinationID] = useState('');
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [pending, setPending] = useState<BackupOperation>();

	const isVolume = entry.resourceType === 'volume';
	const volumeAccess = !isVolume || permissions.hasInLocal('volumes:backup');
	const canRestore = permissions.has('system-backups:restore') && volumeAccess;
	const canManage = permissions.has('system-backups:manage') && volumeAccess;
	const canListDestinations = permissions.has('s3-destinations:list');

	useEffect(() => {
		if (!client || !canListDestinations) return;
		const scope = backupRequestScope(() => alive.current);
		client.s3Destinations
			.options()
			.then((result) => {
				scope.check();
				setDestinations(result);
			})
			.catch((error: unknown) => {
				if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
			});
	}, [alive, canListDestinations, client, clientGeneration]);

	const upload = async () => {
		const scope = backupRequestScope(() => alive.current);
		if (!client) return;
		setBusy(true);
		try {
			if (isVolume) {
				await client.volumes.uploadBackupToS3({
					envID: EnvironmentID.localDocker,
					backupID: entry.id,
					s3DestinationID: destinationID
				});
			} else {
				await client.systemBackups.upload({
					id: entry.id,
					request: { s3DestinationId: destinationID, recoveryKey }
				});
			}
			scope.check();
			showToast(Toasts.info('Backup upload accepted'));
		} catch (error) {
			if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (alive.current) setBusy(false);
		}
	};

	const perform = async (operation: BackupOperation) => {
		const scope = backupRequestScope(() => alive.current);
		if (!client) return;
		setBusy(true);
		try {
			if (operation === 'restore') {
				if (isVolume) {
					await client.volumes.restoreBackup({
						envID: EnvironmentID.localDocker,
						name: entry.resourceName,
						backupID: entry.id
					});
				} else {
					await client.systemBackups.restore({ id: entry.id, request: { recoveryKey } });
				}
				scope.check();
				showToast(
					Toasts.info('Restore request accepted. Refresh server state before further changes.')
				);
			} else {
				if (isVolume) {
					await client.volumes.deleteBackup({
						envID: EnvironmentID.localDocker,
						backupID: entry.id
					});
				} else {
					await client.systemBackups.delete({
						id: entry.id,
						recoveryKey: recoveryKey === '' ? undefined : recoveryKey
					});
				}
				scope.check();
				showToast(Toasts.info('Backup deletion accepted'));
			}
			setRecoveryKey('');
			dismiss();
		} catch (error) {
			if (isCancellation(error)) return;
			setErrorMessage(
				operation === 'restore'
					? `Restore response unavailable: ${friendlyErrorMessage(error)}. Reconnect and verify server state before retrying.`
					: friendlyErrorMessage(error)
			);
		} finally {
			if (alive.current) setBusy(false);
		}
	};

	const openFiles = () =>
		nav.openFiles({
			backupID: entry.id,
			environmentID: isVolume ? EnvironmentID.localDocker : undefined,
			volumeName: isVolume ? entry.resourceName : undefined,
			recoveryKey,
			canRestore
		});

	return {
		entry,
		isVolume,
		canRestore,
		canManage,
		sizeText: formatFileBytes(entry.size),
		recoveryKey,
		setRecoveryKey,
		destinations,
		destinationID,
		setDestinationID,
		busy,
		errorMessage,
		pending,
		setPending,
		confirmTitle: pending === 'restore' ? `Restore ${entry.resourceName}?` : 'Delete backup?',
		confirmAction: pending === 'restore' ? 'Restore' : 'Delete',
		confirmMessage:
			pending === 'restore'
				? 'This replaces existing data. A server restore may disconnect the app. Reconnect and check server state before attempting another restore.'
				: 'This removes the stored backup.',
		confirm: () => {
			if (pending) void perform(pending);
		},
		perform: (operation: BackupOperation) => void perform(operation),
		filesTitle: isVolume ? 'Browse volume files' : 'Browse project files',
		restoreTitle: isVolume ? 'Restore volume' : 'Restore server',
		openFiles,
		upload: () => void upload()
	};
}

export type SystemBackupDetailModel = ReturnType<typeof useSystemBackupDetail>;
