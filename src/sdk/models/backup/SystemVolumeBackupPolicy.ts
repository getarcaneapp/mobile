/** Port of Models/Backup/SystemVolumeBackupPolicy.swift. */
import type { SystemBackupRun } from './SystemBackupRun';

export interface SystemVolumeBackupPolicy {
	id: string;
	enabled: boolean;
	schedule: string;
	retentionCount: number;
	stopContainers: boolean;
	localEnabled: boolean;
	s3Enabled: boolean;
	s3DestinationId?: string;
	s3DestinationName?: string;
	selectionMode: string;
	volumeNames: string[];
	ignoreAnonymous: boolean;
	lastRun?: SystemBackupRun;
}
