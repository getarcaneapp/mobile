import { useCallback, useEffect, useState } from 'react';

import { withCleanup } from '@/core/with-cleanup';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import {
	newPolicyDraft,
	policyDraftIsValid,
	policyDraftUpdate,
	policyDraftVolumeUpdate,
	type BackupPolicyDraft
} from './backup-policy-draft';
import type { BackupPolicyEditorTarget } from './backup-routes';
import {
	backupRequestScope,
	useAliveRef,
	useBackupSessionScope,
	useGlobalPermissions
} from './backup-scope';
import { useDismiss } from './use-backup-forms';

export const policyVolumeSelectionOptions = [
	{ label: 'All', value: 'all' },
	{ label: 'Only listed', value: 'allowlist' },
	{ label: 'Except listed', value: 'blocklist' }
];

export function useBackupPolicyEditor(target: BackupPolicyEditorTarget) {
	const client = useClientManager((s) => s.client);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const permissions = useGlobalPermissions();
	const canListDestinations = permissions.has('s3-destinations:list');
	const dismiss = useDismiss();
	const alive = useAliveRef();
	useBackupSessionScope();

	const [policies, setPolicies] = useState<BackupPolicyDraft[]>([]);
	const [destinations, setDestinations] = useState<S3Destination[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const volumeName = target.kind === 'volume' ? target.volumeName : undefined;
	const environmentID = target.kind === 'volume' ? target.environmentID : undefined;
	const systemVolumes = target.kind === 'systemVolumes';

	const load = useCallback(async () => {
		const scope = backupRequestScope(() => alive.current);
		if (!client) return;
		setLoaded(false);
		setPolicies([]);
		setErrorMessage(undefined);
		try {
			if (volumeName !== undefined) {
				const result = await client.volumes.backupPolicies({
					envID: environmentID,
					name: volumeName
				});
				scope.check();
				setPolicies(
					result.policies.map((p) =>
						newPolicyDraft({
							id: p.id,
							isNew: false,
							enabled: p.enabled,
							schedule: p.schedule,
							retentionCount: p.retentionCount,
							stopContainers: p.stopContainers,
							localEnabled: p.localEnabled,
							s3Enabled: p.s3Enabled,
							s3DestinationId: p.s3DestinationId ?? ''
						})
					)
				);
			} else if (systemVolumes) {
				const result = await client.systemBackups.volumePolicies();
				scope.check();
				setPolicies(
					result.policies.map((p) =>
						newPolicyDraft({
							id: p.id,
							isNew: false,
							enabled: p.enabled,
							schedule: p.schedule,
							retentionCount: p.retentionCount,
							stopContainers: p.stopContainers,
							localEnabled: p.localEnabled,
							s3Enabled: p.s3Enabled,
							s3DestinationId: p.s3DestinationId ?? '',
							selectionMode: p.selectionMode,
							volumeNames: p.volumeNames.join('\n'),
							ignoreAnonymous: p.ignoreAnonymous
						})
					)
				);
			} else {
				const result = await client.systemBackups.policies();
				scope.check();
				setPolicies(
					result.policies.map((p) =>
						newPolicyDraft({
							id: p.id,
							isNew: false,
							enabled: p.enabled,
							schedule: p.schedule,
							retentionCount: p.retentionCount,
							localEnabled: p.localEnabled,
							s3Enabled: p.s3Enabled,
							s3DestinationId: p.s3DestinationId ?? ''
						})
					)
				);
			}
			if (canListDestinations) {
				const options = await client.s3Destinations.options();
				scope.check();
				setDestinations(options);
			}
			scope.check();
			setLoaded(true);
		} catch (error) {
			if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
		}
	}, [alive, canListDestinations, client, environmentID, systemVolumes, volumeName]);

	useEffect(() => {
		void load();
	}, [load, clientGeneration]);

	const save = async () => {
		const scope = backupRequestScope(() => alive.current);
		if (!client) return;
		setBusy(true);
		await withCleanup(
			async () => {
				try {
					if (volumeName !== undefined) {
						await client.volumes.updateBackupPolicies({
							envID: environmentID,
							name: volumeName,
							request: { policies: policies.map(policyDraftUpdate) }
						});
					} else if (systemVolumes) {
						await client.systemBackups.updateVolumePolicies({
							request: { policies: policies.map(policyDraftVolumeUpdate) }
						});
					} else {
						await client.systemBackups.updatePolicies({
							request: { policies: policies.map(policyDraftUpdate) }
						});
					}
					scope.check();
					showToast(Toasts.success('Backup policies saved'));
					dismiss();
				} catch (error) {
					if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => {
				if (alive.current) setBusy(false);
			}
		);
	};

	const update = (id: string, patch: Partial<BackupPolicyDraft>) =>
		setPolicies((current) =>
			current.map((policy) => (policy.id === id ? { ...policy, ...patch } : policy))
		);

	return {
		policies,
		destinations,
		loaded,
		busy,
		errorMessage,
		showsStopContainers: volumeName !== undefined || systemVolumes,
		systemVolumes,
		update,
		remove: (id: string) => setPolicies((current) => current.filter((policy) => policy.id !== id)),
		add: () => setPolicies((current) => [...current, newPolicyDraft()]),
		saveDisabled: !loaded || busy || !policies.every(policyDraftIsValid),
		save: () => void save()
	};
}

export type BackupPolicyEditorModel = ReturnType<typeof useBackupPolicyEditor>;
