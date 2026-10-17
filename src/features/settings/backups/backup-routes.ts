import { useLocalSearchParams } from 'expo-router';

import type { BackupHistoryEntry } from '@/sdk/models/backup/BackupHistoryEntry';
import type { S3Destination } from '@/sdk/models/backup/S3Destination';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';

export const BackupRoutes = {
	detail: 'settings/backups/detail',
	create: 'settings/backups/create',
	runVolumes: 'settings/backups/run-volumes',
	settings: 'settings/backups/settings',
	policies: 'settings/backups/policies',
	s3: 'settings/backups/s3',
	s3Editor: 'settings/backups/s3-editor',
	s3Create: 'settings/backups/s3-create',
	recoveryKey: 'settings/backups/recovery-key',
	discover: 'settings/backups/discover',
	files: 'settings/backups/files'
} as const;

export type BackupPolicyEditorTarget =
	| { kind: 'system' }
	| { kind: 'systemVolumes' }
	| { kind: 'volume'; volumeName: string; environmentID?: string };

export type BackupFilesTarget = {
	backupID: string;
	environmentID?: string;
	volumeName?: string;
	recoveryKey?: string;
	canRestore: boolean;
};

function decodeJSON<T>(value: string | undefined): T | undefined {
	if (!value) return undefined;
	try {
		return JSON.parse(value) as T;
	} catch {
		return undefined;
	}
}

export function useBackupNavigation() {
	const navigation = useSettingsNavigation();
	return {
		...navigation,
		openDetail: (entry: BackupHistoryEntry) =>
			navigation.push(BackupRoutes.detail, { entry: JSON.stringify(entry) }),
		openCreate: () => navigation.push(BackupRoutes.create),
		openVolumeRun: () => navigation.push(BackupRoutes.runVolumes),
		openSettings: () => navigation.push(BackupRoutes.settings),
		openPolicies: (target: BackupPolicyEditorTarget) =>
			navigation.push(BackupRoutes.policies, {
				mode: target.kind,
				volumeName: target.kind === 'volume' ? target.volumeName : undefined,
				environmentID: target.kind === 'volume' ? target.environmentID : undefined
			}),
		openS3: () => navigation.push(BackupRoutes.s3),
		openS3Editor: (destination: S3Destination) =>
			navigation.push(BackupRoutes.s3Editor, { destination: JSON.stringify(destination) }),
		openS3Create: () => navigation.push(BackupRoutes.s3Create),
		openRecoveryKey: () => navigation.push(BackupRoutes.recoveryKey),
		openDiscover: () => navigation.push(BackupRoutes.discover),
		openFiles: (target: BackupFilesTarget) =>
			navigation.push(BackupRoutes.files, {
				backupID: target.backupID,
				environmentID: target.environmentID,
				volumeName: target.volumeName,
				canRestore: target.canRestore ? '1' : undefined,
				key: target.recoveryKey ? settingsPayloads.put(target.recoveryKey) : undefined
			})
	};
}

export function useDetailEntryParam(): BackupHistoryEntry | undefined {
	const { entry } = useLocalSearchParams<{ entry?: string }>();
	return decodeJSON<BackupHistoryEntry>(entry);
}

export function useS3DestinationParam(): S3Destination | undefined {
	const { destination } = useLocalSearchParams<{ destination?: string }>();
	return decodeJSON<S3Destination>(destination);
}

export function usePolicyEditorParam(): BackupPolicyEditorTarget {
	const { mode, volumeName, environmentID } = useLocalSearchParams<{
		mode?: string;
		volumeName?: string;
		environmentID?: string;
	}>();
	if (mode === 'volume' && volumeName) return { kind: 'volume', volumeName, environmentID };
	if (mode === 'systemVolumes') return { kind: 'systemVolumes' };
	return { kind: 'system' };
}

export function useFilesParam(): BackupFilesTarget & { keyToken?: string } {
	const params = useLocalSearchParams<{
		backupID?: string;
		environmentID?: string;
		volumeName?: string;
		canRestore?: string;
		key?: string;
	}>();
	return {
		backupID: params.backupID ?? '',
		environmentID: params.environmentID,
		volumeName: params.volumeName,
		canRestore: params.canRestore === '1',
		recoveryKey: settingsPayloads.get<string>(params.key) ?? '',
		keyToken: params.key
	};
}
