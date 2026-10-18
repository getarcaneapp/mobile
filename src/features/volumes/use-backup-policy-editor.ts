import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import {
	BackupPolicyDraft,
	BackupRequestScope,
	useBackupSessionScope,
	useUnmounted
} from './volume-support';

export function useBackupPolicyEditor(environmentID: EnvironmentID, volumeName: string) {
	const router = useRouter();
	useBackupSessionScope();
	const unmounted = useUnmounted();
	const generation = useClientManager((s) => s.clientGeneration);
	const [policies, setPolicies] = useState<BackupPolicyDraft[]>([]);
	const [destinations, setDestinations] = useState<S3Destination[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const load = useCallback(async () => {
		const scope = new BackupRequestScope();
		const client = useClientManager.getState().client;
		if (!client) return;
		setLoaded(false);
		setPolicies([]);
		setErrorMessage(undefined);
		try {
			const result = await client.volumes.backupPolicies({
				envID: environmentID,
				name: volumeName
			});
			scope.check(() => unmounted.current);
			setPolicies(result.policies.map(BackupPolicyDraft.fromVolumePolicy));
			if (hasPermission('s3-destinations:list', null)) {
				const options = await client.s3Destinations.options();
				scope.check(() => unmounted.current);
				setDestinations(options);
			}
			scope.check(() => unmounted.current);
			setLoaded(true);
		} catch (error) {
			if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
		}
	}, [environmentID, volumeName, unmounted]);

	useEffect(() => {
		void load();
	}, [load, generation]);

	const save = async () => {
		const scope = new BackupRequestScope();
		const client = useClientManager.getState().client;
		if (!client) return;
		setBusy(true);
		await withCleanup(
			async () => {
				try {
					await client.volumes.updateBackupPolicies({
						envID: environmentID,
						name: volumeName,
						request: { policies: policies.map(BackupPolicyDraft.update) }
					});
					scope.check(() => unmounted.current);
					showToast(Toasts.success('Backup policies saved'));
					router.back();
				} catch (error) {
					if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => {
				if (!unmounted.current) setBusy(false);
			}
		);
	};

	const update = (id: string, patch: Partial<BackupPolicyDraft>) =>
		setPolicies((current) => current.map((p) => (p.id === id ? { ...p, ...patch } : p)));

	return {
		policies,
		destinations,
		loaded,
		busy,
		errorMessage,
		canSave: loaded && !busy && policies.every(BackupPolicyDraft.isValid),
		update,
		remove: (id: string) => setPolicies((current) => current.filter((p) => p.id !== id)),
		add: () => setPolicies((current) => [...current, BackupPolicyDraft.make()]),
		save: () => void save()
	};
}

export type BackupPolicyEditorModel = ReturnType<typeof useBackupPolicyEditor>;
