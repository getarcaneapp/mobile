/** Port of Models/Backup/VolumeBackupPolicy.swift. */
import { D } from '../base/decoding';
import { BackupEntry } from '../volume/Backup';

export interface VolumeBackupPolicy {
	id: string;
	volumeName: string;
	enabled: boolean;
	schedule: string;
	retentionCount: number;
	stopContainers: boolean;
	localEnabled: boolean;
	s3Enabled: boolean;
	s3DestinationId?: string;
	s3DestinationName?: string;
	s3Available: boolean;
	s3Bucket?: string;
	lastRun?: BackupEntry;
}

export const VolumeBackupPolicy = {
	decode(this: void, raw: unknown): VolumeBackupPolicy {
		const o = D.object(raw, 'VolumeBackupPolicy');
		return {
			id: D.string(o, 'id'),
			volumeName: D.string(o, 'volumeName'),
			enabled: D.boolean(o, 'enabled'),
			schedule: D.string(o, 'schedule'),
			retentionCount: D.int(o, 'retentionCount'),
			stopContainers: D.boolean(o, 'stopContainers'),
			localEnabled: D.boolean(o, 'localEnabled'),
			s3Enabled: D.boolean(o, 's3Enabled'),
			s3DestinationId: D.optString(o, 's3DestinationId'),
			s3DestinationName: D.optString(o, 's3DestinationName'),
			s3Available: D.boolean(o, 's3Available'),
			s3Bucket: D.optString(o, 's3Bucket'),
			lastRun: D.optNested(o, 'lastRun', BackupEntry.decode)
		};
	},
	encode(this: void, value: VolumeBackupPolicy): Record<string, unknown> {
		const { lastRun, ...rest } = value;
		return { ...rest, lastRun: lastRun === undefined ? undefined : BackupEntry.encode(lastRun) };
	}
} as const;
