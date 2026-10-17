/** Port of Models/Backup/BackupHistoryEntry.swift. */
import type { ISODateString } from '../base/date';

export interface BackupHistoryEntry {
	id: string;
	size: number;
	createdAt: ISODateString;
	status: string;
	trigger: string;
	destination: string;
	format?: string;
	localSnapshotId?: string;
	remoteSnapshotId?: string;
	s3DestinationId?: string;
	s3DestinationName?: string;
	policyId?: string;
	error?: string;
	type: string;
	resourceType: string;
	resourceName: string;
}
