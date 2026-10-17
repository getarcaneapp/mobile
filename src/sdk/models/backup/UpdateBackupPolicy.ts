/** Port of Models/Backup/UpdateBackupPolicy.swift. */

export interface UpdateBackupPolicy {
	id?: string;
	enabled: boolean;
	schedule: string;
	retentionCount: number;
	stopContainers?: boolean;
	localEnabled: boolean;
	s3Enabled: boolean;
	s3DestinationId?: string;
}
