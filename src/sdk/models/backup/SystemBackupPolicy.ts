import type { SystemBackupRun } from './SystemBackupRun';

export interface SystemBackupPolicy {
	id: string;
	enabled: boolean;
	schedule: string;
	retentionCount: number;
	localEnabled: boolean;
	s3Enabled: boolean;
	s3DestinationId?: string;
	s3DestinationName?: string;
	lastRun?: SystemBackupRun;
}
