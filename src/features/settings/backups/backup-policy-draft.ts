import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import type { UpdateBackupPolicy } from '@/sdk/models/backup/UpdateBackupPolicy';
import type { UpdateSystemVolumeBackupPolicy } from '@/sdk/models/backup/UpdateSystemVolumeBackupPolicy';
import type { FormPickerOption } from '@/ui/components/form-fields.types';

export type BackupPolicyDraft = {
	id: string;
	isNew: boolean;
	enabled: boolean;
	schedule: string;
	retentionCount: number;
	stopContainers: boolean;
	localEnabled: boolean;
	s3Enabled: boolean;
	s3DestinationId: string;
	selectionMode: string;
	volumeNames: string;
	ignoreAnonymous: boolean;
};

let nextDraftID = 0;

export function newPolicyDraft(init: Partial<BackupPolicyDraft> = {}): BackupPolicyDraft {
	return {
		id: `draft-${Date.now().toString(36)}-${nextDraftID++}`,
		isNew: true,
		enabled: false,
		schedule: '0 0 2 * * *',
		retentionCount: 7,
		stopContainers: false,
		localEnabled: true,
		s3Enabled: false,
		s3DestinationId: '',
		selectionMode: 'all',
		volumeNames: '',
		ignoreAnonymous: true,
		...init
	};
}

export function policyDraftIsValid(draft: BackupPolicyDraft): boolean {
	return (
		draft.schedule.trim() !== '' &&
		draft.retentionCount >= 0 &&
		draft.retentionCount <= 3650 &&
		(draft.localEnabled || draft.s3Enabled) &&
		(!draft.s3Enabled || draft.s3DestinationId !== '')
	);
}

export function policyDraftUpdate(draft: BackupPolicyDraft): UpdateBackupPolicy {
	return {
		id: draft.isNew ? undefined : draft.id,
		enabled: draft.enabled,
		schedule: draft.schedule,
		retentionCount: draft.retentionCount,
		stopContainers: draft.stopContainers,
		localEnabled: draft.localEnabled,
		s3Enabled: draft.s3Enabled,
		s3DestinationId: draft.s3DestinationId === '' ? undefined : draft.s3DestinationId
	};
}

export function policyDraftVolumeUpdate(draft: BackupPolicyDraft): UpdateSystemVolumeBackupPolicy {
	return {
		...policyDraftUpdate(draft),
		selectionMode: draft.selectionMode,
		volumeNames: draft.volumeNames.split('\n').filter((name) => name !== ''),
		ignoreAnonymous: draft.ignoreAnonymous
	};
}

export type BackupOperation = 'restore' | 'delete';

export function destinationPickerOptions(
	selection: string,
	destinations: S3Destination[]
): FormPickerOption<string>[] {
	const options: FormPickerOption<string>[] = [
		{ label: 'Select destination', value: '' },
		...destinations.map((destination) => ({ label: destination.name, value: destination.id }))
	];
	if (selection !== '' && !destinations.some((destination) => destination.id === selection)) {
		options.push({ label: selection, value: selection });
	}
	return options;
}

export const storageOptions: FormPickerOption<string>[] = [
	{ label: 'Local', value: 'local' },
	{ label: 'S3', value: 's3' },
	{ label: 'Local and S3', value: 'local_s3' }
];
