/**
 * Port of Services/VolumesService.swift (+ `+BackupPolicies`, `+Workspace`).
 *
 * VolumesService groups all volume, browse, and backup endpoints registered
 * under `/environments/{id}/volumes`.
 */
import type { ArcaneAuthorizedRequest } from '../client/ArcaneTransport';
import type { EnvironmentID } from '../client/environment';
import { q, boolString, type QueryItem } from '../client/url';
import { ArcaneError } from '../errors/ArcaneError';
import { encodeArcaneJSON } from '../http/json';
import type { MultipartFile } from '../http/multipart';
import type { RESTService } from '../http/RESTService';
import { MessageResponse } from '../models/base/message';
import { SearchPaginationSort } from '../models/base/pagination';
import type { BackupFileEntry } from '../models/backup/BackupFileEntry';
import type { CreateVolumeBackupRequest } from '../models/backup/CreateVolumeBackupRequest';
import type { UpdateVolumeBackupPolicies } from '../models/backup/UpdateVolumeBackupPolicies';
import { VolumeBackupPolicyCollection } from '../models/backup/VolumeBackupPolicyCollection';
import { ProjectWorkspace } from '../models/project/ProjectFiles';
import {
	BackupEntry,
	RestoreBackupFilesRequest,
	VolumeBackupListPage,
	type BackupHasPath,
	type DiscoverVolumeBackupsResponse
} from '../models/volume/Backup';
import type { FileContent, FileEntry } from '../models/volume/Browse';
import {
	Volume,
	VolumePruneReport,
	type CreateVolume,
	type VolumeSizeInfo,
	type VolumeUsage,
	type VolumeUsageCounts
} from '../models/volume/Volume';
import type {
	VolumeWorkspace,
	VolumeWorkspaceFileContent,
	VolumeWorkspaceUpdateManifest
} from '../models/volume/VolumeWorkspace';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

/** Swift `URL.lastPathComponent` for a file URI. */
function lastPathComponent(uri: string): string {
	const path = uri.replace(/[?#].*$/, '').replace(/\/+$/, '');
	const component = path.slice(path.lastIndexOf('/') + 1);
	try {
		return decodeURIComponent(component);
	} catch {
		return component;
	}
}

export class VolumesService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	// MARK: - Volumes

	/** Paginated list of Docker volumes for the environment. */
	list(
		args: {
			envID?: EnvironmentID;
			query?: SearchPaginationSort;
			inUse?: boolean;
			includeInternal?: boolean;
		} = {}
	): Promise<PaginatedResponse<Volume>> {
		const query = args.query ?? {};
		const items = SearchPaginationSort.nonPaginationQueryItems(query);
		if (args.inUse !== undefined) items.push(q('inUse', boolString(args.inUse)));
		if (args.includeInternal ?? false) items.push(q('includeInternal', 'true'));
		return this.rest.paginated(this.rest.environmentPath(args.envID, 'volumes'), {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: items,
			decode: Volume.decode
		});
	}

	/** Get a single volume by name. */
	inspect(args: { envID?: EnvironmentID; name: string }): Promise<Volume> {
		return this.rest.get(this.rest.environmentPath(args.envID, `volumes/${args.name}`), {
			decode: Volume.decode
		});
	}

	/** Create a new Docker volume. */
	create(args: { envID?: EnvironmentID; request: CreateVolume }): Promise<Volume> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'volumes'), {
			body: args.request,
			decode: Volume.decode
		});
	}

	/** Remove a volume, optionally forcing removal even if it is in use. */
	remove(args: { envID?: EnvironmentID; name: string; force?: boolean }): Promise<MessageResponse> {
		const items: QueryItem[] = [];
		if (args.force ?? false) items.push(q('force', 'true'));
		return this.rest.delete(this.rest.environmentPath(args.envID, `volumes/${args.name}`), {
			query: items,
			decode: MessageResponse.decode
		});
	}

	/** Prune unused volumes and return the prune report. */
	prune(args: { envID?: EnvironmentID } = {}): Promise<VolumePruneReport> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'volumes/prune'), {
			decode: VolumePruneReport.decode
		});
	}

	/** Get container usage information for a single volume. */
	usage(args: { envID?: EnvironmentID; name: string }): Promise<VolumeUsage> {
		return this.rest.get(this.rest.environmentPath(args.envID, `volumes/${args.name}/usage`));
	}

	/** Get aggregate usage counts (in use / unused / total). */
	counts(
		args: { envID?: EnvironmentID; includeInternal?: boolean } = {}
	): Promise<VolumeUsageCounts> {
		const items: QueryItem[] = [];
		if (args.includeInternal ?? false) items.push(q('includeInternal', 'true'));
		return this.rest.get(this.rest.environmentPath(args.envID, 'volumes/counts'), { query: items });
	}

	/** Compute disk usage sizes for all volumes (slow). */
	sizes(args: { envID?: EnvironmentID } = {}): Promise<VolumeSizeInfo[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'volumes/sizes'));
	}

	// MARK: - Browse

	/** List directory entries inside a volume. */
	browse(args: { envID?: EnvironmentID; name: string; path?: string }): Promise<FileEntry[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, `volumes/${args.name}/browse`), {
			query: [q('path', args.path ?? '/')]
		});
	}

	/** Get a preview of a file in a volume. */
	fileContent(args: {
		envID?: EnvironmentID;
		name: string;
		path: string;
		maxBytes?: number;
	}): Promise<FileContent> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/browse/content`),
			{
				query: [q('path', args.path), q('maxBytes', String(args.maxBytes ?? 1_048_576))]
			}
		);
	}

	/** Create a new directory inside a volume. */
	createDirectory(args: {
		envID?: EnvironmentID;
		name: string;
		path: string;
	}): Promise<MessageResponse> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/browse/mkdir`),
			{
				query: [q('path', args.path)],
				decode: MessageResponse.decode
			}
		);
	}

	/** Delete a file or directory inside a volume. */
	deleteFile(args: {
		envID?: EnvironmentID;
		name: string;
		path: string;
	}): Promise<MessageResponse> {
		return this.rest.delete(this.rest.environmentPath(args.envID, `volumes/${args.name}/browse`), {
			query: [q('path', args.path)],
			decode: MessageResponse.decode
		});
	}

	// MARK: - Backups

	/** Paginated list of backups for a volume. */
	listBackups(args: {
		envID?: EnvironmentID;
		name: string;
		query?: SearchPaginationSort;
	}): Promise<PaginatedResponse<BackupEntry>> {
		const query = args.query ?? {};
		return this.rest.paginated(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/backups`),
			{
				start: query.start ?? 0,
				limit: query.limit ?? 20,
				query: SearchPaginationSort.nonPaginationQueryItems(query),
				decode: BackupEntry.decode
			}
		);
	}

	/** Create a new backup of a volume. */
	createBackup(args: {
		envID?: EnvironmentID;
		name: string;
		request?: CreateVolumeBackupRequest;
	}): Promise<BackupEntry> {
		return this.rest.post(this.rest.environmentPath(args.envID, `volumes/${args.name}/backups`), {
			body: args.request ?? {},
			decode: BackupEntry.decode
		});
	}

	/** Restore an entire backup over a volume. */
	restoreBackup(args: {
		envID?: EnvironmentID;
		name: string;
		backupID: string;
	}): Promise<MessageResponse> {
		return this.rest.post(
			this.rest.environmentPath(
				args.envID,
				`volumes/${args.name}/backups/${args.backupID}/restore`
			),
			{ decode: MessageResponse.decode }
		);
	}

	/**
	 * Restore selected files from a backup.
	 * Swift overload `restoreBackupFiles(envID:name:backupID:paths:)`.
	 */
	restoreBackupFilesWithPaths(args: {
		envID?: EnvironmentID;
		name: string;
		backupID: string;
		paths: string[];
	}): Promise<MessageResponse> {
		return this.restoreBackupFiles({
			envID: args.envID,
			name: args.name,
			backupID: args.backupID,
			selection: RestoreBackupFilesRequest.make({ paths: args.paths })
		});
	}

	/** Delete a backup. */
	deleteBackup(args: { envID?: EnvironmentID; backupID: string }): Promise<MessageResponse> {
		return this.rest.delete(
			this.rest.environmentPath(args.envID, `volumes/backups/${args.backupID}`),
			{
				decode: MessageResponse.decode
			}
		);
	}

	/** Discover volume backups stored on an S3 destination by this or other instances. */
	discoverBackups(args: {
		envID?: EnvironmentID;
		s3DestinationId: string;
	}): Promise<DiscoverVolumeBackupsResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'volumes/backups/discover'), {
			body: { s3DestinationId: args.s3DestinationId }
		});
	}

	/** Check whether a backup contains the given path. */
	backupHasPath(args: {
		envID?: EnvironmentID;
		backupID: string;
		path: string;
	}): Promise<BackupHasPath> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `volumes/backups/${args.backupID}/has-path`),
			{
				query: [q('path', args.path)]
			}
		);
	}

	/** List the files contained inside a backup. */
	listBackupFiles(args: { envID?: EnvironmentID; backupID: string }): Promise<string[]> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `volumes/backups/${args.backupID}/files`)
		);
	}

	// MARK: - Binary uploads & downloads

	/** Upload a file or directory into a volume at `path` (multipart upload). `fileURL` is a local file URI. */
	uploadFile(args: {
		envID?: EnvironmentID;
		name: string;
		path: string;
		fileURL: string;
		filename?: string;
	}): Promise<MessageResponse> {
		const part: MultipartFile = {
			fieldName: 'file',
			filename: args.filename ?? lastPathComponent(args.fileURL),
			uri: args.fileURL
		};
		return this.rest.transport.multipartUpload(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/browse/upload`),
			{ query: [q('path', args.path)], files: [part], decode: MessageResponse.decode }
		);
	}

	/**
	 * Upload a backup tarball to a volume.
	 * @deprecated Use `uploadAndRestoreBackup`; this endpoint returns a restore message, not a backup record.
	 */
	uploadBackup(args: {
		envID?: EnvironmentID;
		name: string;
		fileURL: string;
		filename?: string;
	}): Promise<BackupEntry> {
		const part: MultipartFile = {
			fieldName: 'backup',
			filename: args.filename ?? lastPathComponent(args.fileURL),
			uri: args.fileURL
		};
		return this.rest.transport.multipartUpload(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/backups/upload`),
			{ files: [part], decode: BackupEntry.decode }
		);
	}

	/**
	 * Download the raw bytes of a file inside a volume.
	 * @deprecated Use `downloadFileDownloadRequest` for potentially large files.
	 */
	downloadFile(args: { envID?: EnvironmentID; name: string; path: string }): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/browse/download`),
			{ query: [q('path', args.path)] }
		);
	}

	/** Authenticated request for downloading a volume file to disk (Swift `downloadFile(..., to:)`). */
	downloadFileDownloadRequest(args: {
		envID?: EnvironmentID;
		name: string;
		path: string;
	}): Promise<ArcaneAuthorizedRequest> {
		return this.rest.transport.downloadRequest(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/browse/download`),
			{ query: [q('path', args.path)] }
		);
	}

	/**
	 * Download a backup tarball as raw bytes.
	 * @deprecated Use `downloadBackupDownloadRequest` for large backup archives.
	 */
	downloadBackup(args: { envID?: EnvironmentID; backupID: string }): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw(
			this.rest.environmentPath(args.envID, `volumes/backups/${args.backupID}/download`)
		);
	}

	/** Authenticated request for downloading a backup tarball to disk (Swift `downloadBackup(..., to:)`). */
	downloadBackupDownloadRequest(args: {
		envID?: EnvironmentID;
		backupID: string;
	}): Promise<ArcaneAuthorizedRequest> {
		return this.rest.transport.downloadRequest(
			this.rest.environmentPath(args.envID, `volumes/backups/${args.backupID}/download`)
		);
	}

	// MARK: - Backup policies (VolumesService+BackupPolicies.swift)

	backupPolicies(args: {
		envID?: EnvironmentID;
		name: string;
	}): Promise<VolumeBackupPolicyCollection> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/backup-policy`),
			{
				decode: VolumeBackupPolicyCollection.decode
			}
		);
	}

	updateBackupPolicies(args: {
		envID?: EnvironmentID;
		name: string;
		request: UpdateVolumeBackupPolicies;
	}): Promise<VolumeBackupPolicyCollection> {
		return this.rest.put(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/backup-policy`),
			{
				body: args.request,
				decode: VolumeBackupPolicyCollection.decode
			}
		);
	}

	async listBackupsWithWarnings(args: {
		envID?: EnvironmentID;
		name: string;
		query?: SearchPaginationSort;
	}): Promise<VolumeBackupListPage> {
		const query = args.query ?? {};
		const items = SearchPaginationSort.nonPaginationQueryItems(query);
		items.push(q('start', String(query.start ?? 0)));
		items.push(q('limit', String(query.limit ?? 20)));
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/backups`),
			{ query: items }
		);
		return this.rest.transport.decode(text, VolumeBackupListPage.decode);
	}

	browseBackupFiles(args: {
		envID?: EnvironmentID;
		backupID: string;
		path?: string;
		search?: string;
		start?: number;
		limit?: number;
	}): Promise<PaginatedResponse<BackupFileEntry>> {
		return this.rest.paginated(
			this.rest.environmentPath(args.envID, `volumes/backups/${args.backupID}/files/browse`),
			{
				start: args.start ?? 0,
				limit: args.limit ?? 20,
				query: [q('path', args.path ?? ''), q('search', args.search ?? '')]
			}
		);
	}

	/** Restore selected files from a backup. */
	restoreBackupFiles(args: {
		envID?: EnvironmentID;
		name: string;
		backupID: string;
		selection: RestoreBackupFilesRequest;
	}): Promise<MessageResponse> {
		return this.rest.post(
			this.rest.environmentPath(
				args.envID,
				`volumes/${args.name}/backups/${args.backupID}/restore-files`
			),
			{ body: args.selection, decode: MessageResponse.decode }
		);
	}

	uploadBackupToS3(args: {
		envID?: EnvironmentID;
		backupID: string;
		s3DestinationID: string;
	}): Promise<BackupEntry> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `volumes/backups/${args.backupID}/upload`),
			{
				body: { s3DestinationId: args.s3DestinationID },
				decode: BackupEntry.decode
			}
		);
	}

	/** Consumes a complete volume-backup upload session and restores the archive into the volume. */
	uploadAndRestoreBackup(args: {
		envID?: EnvironmentID;
		name: string;
		uploadID: string;
	}): Promise<MessageResponse> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/backups/upload`),
			{
				body: { uploadId: args.uploadID },
				decode: MessageResponse.decode
			}
		);
	}

	/**
	 * Legacy multipart archive import for v1 servers. The response is a restore
	 * message, not a backup record. Swift overload `uploadAndRestoreBackup(envID:name:fileURL:)`.
	 */
	uploadAndRestoreBackupFile(args: {
		envID?: EnvironmentID;
		name: string;
		fileURL: string;
	}): Promise<MessageResponse> {
		return this.rest.transport.multipartUpload(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/backups/upload`),
			{
				files: [
					{ fieldName: 'backup', filename: lastPathComponent(args.fileURL), uri: args.fileURL }
				],
				decode: MessageResponse.decode
			}
		);
	}

	// MARK: - Workspace (VolumesService+Workspace.swift)

	workspace(args: { envID?: EnvironmentID; name: string }): Promise<VolumeWorkspace> {
		return this.rest.get(this.rest.environmentPath(args.envID, `volumes/${args.name}/workspace`), {
			decode: ProjectWorkspace.decode
		});
	}

	workspaceFile(args: {
		envID?: EnvironmentID;
		name: string;
		relativePath: string;
	}): Promise<VolumeWorkspaceFileContent> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/workspace/file`),
			{
				query: [q('relativePath', args.relativePath)]
			}
		);
	}

	/** Authenticated request for downloading a workspace file to disk (Swift `downloadWorkspaceFile(..., to:)`). */
	downloadWorkspaceFileDownloadRequest(args: {
		envID?: EnvironmentID;
		name: string;
		relativePath: string;
	}): Promise<ArcaneAuthorizedRequest> {
		return this.rest.transport.downloadRequest(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/workspace/file/download`),
			{ query: [q('relativePath', args.relativePath)] }
		);
	}

	/**
	 * Atomically apply a revision-checked workspace manifest. Files are streamed
	 * from disk (`files` are local file URIs). A conflict is returned to the
	 * caller without refreshing or retrying the mutation.
	 */
	updateWorkspace(args: {
		envID?: EnvironmentID;
		name: string;
		manifest: VolumeWorkspaceUpdateManifest;
		files?: string[];
	}): Promise<VolumeWorkspace> {
		const { manifest } = args;
		const files = args.files ?? [];
		if (
			manifest.fileTreeRevision === '' ||
			manifest.fileChanges.length < 1 ||
			manifest.fileChanges.length > 500
		) {
			return Promise.reject(
				ArcaneError.validation({ manifest: ['A revision and 1 to 500 changes are required.'] })
			);
		}
		for (const change of manifest.fileChanges) {
			for (const index of [change.uploadIndex, change.baselineIndex]) {
				if (index === undefined) continue;
				if (!(index >= 0 && index < files.length)) {
					return Promise.reject(
						ArcaneError.validation({ files: ['Upload index is outside the supplied files.'] })
					);
				}
			}
			if (
				(change.operation === 'create_file' || change.operation === 'update_file') &&
				change.uploadIndex === undefined
			) {
				return Promise.reject(
					ArcaneError.validation({ files: ['Create and update operations require a file upload.'] })
				);
			}
		}
		const uploads: MultipartFile[] = files.map((uri) => ({
			fieldName: 'files',
			filename: lastPathComponent(uri),
			uri
		}));
		return this.rest.transport.multipartUpload(
			this.rest.environmentPath(args.envID, `volumes/${args.name}/workspace`),
			{
				method: 'PUT',
				fields: { manifest: encodeArcaneJSON(manifest) },
				files: uploads,
				decode: ProjectWorkspace.decode
			}
		);
	}
}
