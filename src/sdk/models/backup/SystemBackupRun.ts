import type { ISODateString } from '../base/date';

export interface SystemBackupRun {
	activityId?: string;
	id: string;
	size: number;
	createdAt: ISODateString;
	status: string;
	trigger: string;
	destination: string;
	localSnapshotId?: string;
	remoteSnapshotId?: string;
	s3DestinationId?: string;
	s3DestinationName?: string;
	policyId?: string;
	error?: string;
}
