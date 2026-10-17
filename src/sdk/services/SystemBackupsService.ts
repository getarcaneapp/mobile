import { q } from '../client/url';
import type { RESTService } from '../http/RESTService';
import { D } from '../models/base/decoding';
import { MessageResponse } from '../models/base/message';
import { SearchPaginationSort } from '../models/base/pagination';
import type { BackupFileEntry } from '../models/backup/BackupFileEntry';
import type { BackupHistoryEntry } from '../models/backup/BackupHistoryEntry';
import type { BackupRunAccepted } from '../models/backup/BackupRunAccepted';
import type { CreateSystemBackupRequest } from '../models/backup/CreateSystemBackupRequest';
import type { DiscoverSystemBackupsRequest } from '../models/backup/DiscoverSystemBackupsRequest';
import type { RestoreSystemBackupFilesRequest } from '../models/backup/RestoreSystemBackupFilesRequest';
import type { RestoreSystemBackupRequest } from '../models/backup/RestoreSystemBackupRequest';
import type { RunSystemVolumeBackupsRequest } from '../models/backup/RunSystemVolumeBackupsRequest';
import type { SystemBackupPolicyCollection } from '../models/backup/SystemBackupPolicyCollection';
import type { SystemBackupRecoveryKey } from '../models/backup/SystemBackupRecoveryKey';
import type { SystemBackupRecoveryKeyStatus } from '../models/backup/SystemBackupRecoveryKeyStatus';
import type { SystemBackupRun } from '../models/backup/SystemBackupRun';
import type { SystemVolumeBackupOption } from '../models/backup/SystemVolumeBackupOption';
import type { SystemVolumeBackupPolicyCollection } from '../models/backup/SystemVolumeBackupPolicyCollection';
import type { UpdateSystemBackupPolicies } from '../models/backup/UpdateSystemBackupPolicies';
import type { UpdateSystemVolumeBackupPolicies } from '../models/backup/UpdateSystemVolumeBackupPolicies';
import type { UploadSystemBackupRequest } from '../models/backup/UploadSystemBackupRequest';
import { decodePaginatedResponse } from '../client/ArcaneTransport';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

export class SystemBackupsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	list(args: { query?: SearchPaginationSort } = {}): Promise<PaginatedResponse<SystemBackupRun>> {
		const query = args.query ?? {};
		return this.rest.paginated('backups', {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: SearchPaginationSort.nonPaginationQueryItems(query)
		});
	}

	history(
		args: { query?: SearchPaginationSort; type?: string } = {}
	): Promise<PaginatedResponse<BackupHistoryEntry>> {
		const query = args.query ?? {};
		const items = SearchPaginationSort.nonPaginationQueryItems(query);
		if (args.type !== undefined) items.push(q('type', args.type));
		return this.rest.paginated('backups/history', {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: items
		});
	}

	policies(): Promise<SystemBackupPolicyCollection> {
		return this.rest.requestPayload('backups/policies', { method: 'GET' });
	}

	updatePolicies(args: {
		request: UpdateSystemBackupPolicies;
	}): Promise<SystemBackupPolicyCollection> {
		return this.rest.requestPayload('backups/policies', { method: 'PUT', body: args.request });
	}

	volumePolicies(): Promise<SystemVolumeBackupPolicyCollection> {
		return this.rest.requestPayload('backups/volumes/config', { method: 'GET' });
	}

	updateVolumePolicies(args: {
		request: UpdateSystemVolumeBackupPolicies;
	}): Promise<SystemVolumeBackupPolicyCollection> {
		return this.rest.requestPayload('backups/volumes/config', {
			method: 'PUT',
			body: args.request
		});
	}

	volumeOptions(): Promise<SystemVolumeBackupOption[]> {
		return this.rest.requestPayload('backups/volumes/options', { method: 'GET' });
	}

	runVolumeBackups(
		args: { request?: RunSystemVolumeBackupsRequest } = {}
	): Promise<BackupRunAccepted> {
		return this.rest.requestPayload('backups/volumes/run', { body: args.request ?? {} });
	}

	generateRecoveryKey(): Promise<SystemBackupRecoveryKey> {
		return this.rest.requestPayload('backups/recovery-key/generate');
	}

	setRecoveryKey(args: {
		request: SystemBackupRecoveryKey;
	}): Promise<SystemBackupRecoveryKeyStatus> {
		return this.rest.requestPayload('backups/recovery-key', { method: 'PUT', body: args.request });
	}

	create(args: { request?: CreateSystemBackupRequest } = {}): Promise<SystemBackupRun> {
		return this.rest.requestPayload('backups', { body: args.request ?? {} });
	}

	discover(args: { request: DiscoverSystemBackupsRequest }): Promise<number> {
		return this.rest.requestPayload('backups/discover', { body: args.request, decode: D.num });
	}

	restore(args: { id: string; request: RestoreSystemBackupRequest }): Promise<MessageResponse> {
		return this.rest.requestPayload(`backups/${args.id}/restore`, {
			body: args.request,
			decode: MessageResponse.decode
		});
	}

	browseFiles(args: {
		id: string;
		recoveryKey: string;
		path?: string;
		search?: string;
		start?: number;
		limit?: number;
	}): Promise<PaginatedResponse<BackupFileEntry>> {
		return this.rest.requestPayload(`backups/${args.id}/files/browse`, {
			body: { recoveryKey: args.recoveryKey } satisfies SystemBackupRecoveryKey,
			query: [
				q('path', args.path ?? ''),
				q('search', args.search ?? ''),
				q('start', String(args.start ?? 0)),
				q('limit', String(args.limit ?? 20))
			],
			decode: (raw) => decodePaginatedResponse<BackupFileEntry>(raw)
		});
	}

	restoreFiles(args: {
		id: string;
		request: RestoreSystemBackupFilesRequest;
	}): Promise<MessageResponse> {
		return this.rest.requestPayload(`backups/${args.id}/restore-files`, {
			body: args.request,
			decode: MessageResponse.decode
		});
	}

	upload(args: { id: string; request: UploadSystemBackupRequest }): Promise<SystemBackupRun> {
		return this.rest.requestPayload(`backups/${args.id}/upload`, { body: args.request });
	}

	delete(args: { id: string; recoveryKey?: string }): Promise<MessageResponse> {
		return this.rest.requestPayload(`backups/${args.id}`, {
			method: 'DELETE',
			body: { recoveryKey: args.recoveryKey },
			decode: MessageResponse.decode
		});
	}
}
