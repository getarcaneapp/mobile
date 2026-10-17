/** Port of Models/Backup/UpdateSystemVolumeBackupPolicy.swift. */

export interface UpdateSystemVolumeBackupPolicy {
	id?: string;
	enabled: boolean;
	schedule: string;
	retentionCount: number;
	stopContainers?: boolean;
	localEnabled: boolean;
	s3Enabled: boolean;
	s3DestinationId?: string;
	selectionMode: string;
	volumeNames: string[];
	ignoreAnonymous: boolean;
}
