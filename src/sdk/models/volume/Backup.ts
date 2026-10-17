/** Port of Models/Volume/Backup.swift. */
import type { PaginationResponse } from '../base/pagination';
import { D } from '../base/decoding';

/** BackupEntry represents a single volume backup record. */
export interface BackupEntry {
	id: string;
	volumeName: string;
	size: number;
	createdAt: string;
	/** JSON key `activityId`. */
	activityID?: string;
	status?: string;
	trigger?: string;
	destination?: string;
	format?: string;
	localSnapshotId?: string;
	remoteSnapshotId?: string;
	s3DestinationId?: string;
	s3DestinationName?: string;
	remoteInstanceId?: string;
	policyId?: string;
	error?: string;
	type?: string;
}

export const BackupEntry = {
	decode(this: void, raw: unknown): BackupEntry {
		const o = D.object(raw, 'BackupEntry');
		return {
			id: D.string(o, 'id'),
			volumeName: D.string(o, 'volumeName'),
			size: D.number(o, 'size'),
			createdAt: D.string(o, 'createdAt'),
			activityID: D.optString(o, 'activityId'),
			status: D.optString(o, 'status'),
			trigger: D.optString(o, 'trigger'),
			destination: D.optString(o, 'destination'),
			format: D.optString(o, 'format'),
			localSnapshotId: D.optString(o, 'localSnapshotId'),
			remoteSnapshotId: D.optString(o, 'remoteSnapshotId'),
			s3DestinationId: D.optString(o, 's3DestinationId'),
			s3DestinationName: D.optString(o, 's3DestinationName'),
			remoteInstanceId: D.optString(o, 'remoteInstanceId'),
			policyId: D.optString(o, 'policyId'),
			error: D.optString(o, 'error'),
			type: D.optString(o, 'type')
		};
	},
	encode(this: void, value: BackupEntry): Record<string, unknown> {
		const { activityID, ...rest } = value;
		return { ...rest, activityId: activityID };
	}
} as const;

/** VolumeBackupListPage is the page envelope returned by `GET volumes/{name}/backups`. */
export interface VolumeBackupListPage {
	success: boolean;
	data: BackupEntry[];
	pagination: PaginationResponse;
	warnings?: string[];
}

export const VolumeBackupListPage = {
	decode(this: void, raw: unknown): VolumeBackupListPage {
		const o = D.object(raw, 'VolumeBackupListPage');
		return {
			success: D.boolean(o, 'success'),
			data: D.array(o, 'data', BackupEntry.decode),
			pagination: D.nested(o, 'pagination', D.cast<PaginationResponse>),
			warnings: D.optArray(o, 'warnings', D.str)
		};
	}
} as const;

/** BackupHasPath is the response for the `has-path` lookup. */
export interface BackupHasPath {
	exists: boolean;
}

/** RestoreBackupFilesRequest is the body for the partial restore endpoint. */
export interface RestoreBackupFilesRequest {
	paths: string[];
	selectAll?: boolean;
	search?: string;
}

export const RestoreBackupFilesRequest = {
	make(init: Partial<RestoreBackupFilesRequest> = {}): RestoreBackupFilesRequest {
		return { paths: init.paths ?? [], selectAll: init.selectAll, search: init.search };
	}
} as const;

/** DiscoverVolumeBackupsRequest scans an S3 destination for existing backups. */
export interface DiscoverVolumeBackupsRequest {
	s3DestinationId: string;
}

/** DiscoverVolumeBackupsResponse reports newly imported backups. */
export interface DiscoverVolumeBackupsResponse {
	count: number;
	errors?: string[];
}
