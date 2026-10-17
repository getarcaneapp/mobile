import type { EnvironmentID } from '../client/environment';
import { boolString, q, type QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { SortOrder } from '../models/base/pagination';
import type {
	CreateGitOpsSync,
	CreateGitRepository,
	GitOpsBranchesResponse,
	GitOpsBrowseResponse,
	GitOpsSync,
	GitOpsSyncResult,
	GitOpsSyncStatus,
	GitRepository,
	UpdateGitOpsSync,
	UpdateGitRepository
} from '../models/gitOps/GitOps';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';
import {
	ResolveGitBackupConflictRequest,
	type GitBackupHistoryResponse,
	type GitBackupPreview,
	type GitBackupRevision,
	type GitRepositorySyncRequest,
	type ImportGitOpsSyncRequest,
	type ImportGitOpsSyncResponse
} from '../types/gitOps/GitOpsSyncAndBackup';

export class GitOpsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	listRepositoriesPaginated(
		args: { search?: string; sort?: string; order?: SortOrder; start?: number; limit?: number } = {}
	): Promise<PaginatedResponse<GitRepository>> {
		const query: QueryItem[] = [];
		if (args.search !== undefined) query.push(q('search', args.search));
		if (args.sort !== undefined) query.push(q('sort', args.sort));
		if (args.order !== undefined) query.push(q('order', args.order));
		return this.rest.transport.paginated('customize/git-repositories', {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query
		});
	}

	getRepository(args: { id: string }): Promise<GitRepository> {
		return this.rest.get(`customize/git-repositories/${args.id}`);
	}

	createRepository(args: { body: CreateGitRepository }): Promise<GitRepository> {
		return this.rest.post('customize/git-repositories', { body: args.body });
	}

	updateRepository(args: { id: string; body: UpdateGitRepository }): Promise<GitRepository> {
		return this.rest.put(`customize/git-repositories/${args.id}`, { body: args.body });
	}

	deleteRepository(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`customize/git-repositories/${args.id}`);
	}

	testRepository(args: { id: string; branch?: string }): Promise<void> {
		const query: QueryItem[] = [];
		if (args.branch !== undefined) query.push(q('branch', args.branch));
		return this.rest.postVoid(`customize/git-repositories/${args.id}/test`, { query });
	}

	listBranches(args: { id: string }): Promise<GitOpsBranchesResponse> {
		return this.rest.get(`customize/git-repositories/${args.id}/branches`);
	}

	browseRepositoryFiles(args: {
		id: string;
		branch: string;
		path?: string;
	}): Promise<GitOpsBrowseResponse> {
		const query: QueryItem[] = [q('branch', args.branch)];
		if (args.path !== undefined) query.push(q('path', args.path));
		return this.rest.get(`customize/git-repositories/${args.id}/files`, { query });
	}

	syncRepositories(args: { body: GitRepositorySyncRequest }): Promise<void> {
		return this.rest.postVoid('git-repositories/sync', { body: args.body });
	}

	listSyncsPaginated(
		args: {
			search?: string;
			sort?: string;
			order?: SortOrder;
			start?: number;
			limit?: number;
			mode?: string;
			projectId?: string;
			repositoryId?: string;
			autoSync?: boolean;
			envID?: EnvironmentID;
		} = {}
	): Promise<PaginatedResponse<GitOpsSync>> {
		const query: QueryItem[] = [];
		if (args.search !== undefined) query.push(q('search', args.search));
		if (args.sort !== undefined) query.push(q('sort', args.sort));
		if (args.order !== undefined) query.push(q('order', args.order));
		if (args.mode !== undefined) query.push(q('mode', args.mode));
		if (args.projectId !== undefined) query.push(q('projectId', args.projectId));
		if (args.repositoryId !== undefined) query.push(q('repositoryId', args.repositoryId));
		if (args.autoSync !== undefined) query.push(q('autoSync', boolString(args.autoSync)));
		return this.rest.transport.paginated(this.rest.environmentPath(args.envID, 'gitops-syncs'), {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query
		});
	}

	createSync(args: { body: CreateGitOpsSync; envID?: EnvironmentID }): Promise<GitOpsSync> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'gitops-syncs'), {
			body: args.body
		});
	}

	getSync(args: { id: string; envID?: EnvironmentID }): Promise<GitOpsSync> {
		return this.rest.get(this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}`));
	}

	updateSync(args: {
		id: string;
		body: UpdateGitOpsSync;
		envID?: EnvironmentID;
	}): Promise<GitOpsSync> {
		return this.rest.put(this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}`), {
			body: args.body
		});
	}

	deleteSync(args: { id: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}`));
	}

	performSync(args: { id: string; envID?: EnvironmentID }): Promise<GitOpsSyncResult> {
		return this.rest.post(this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}/sync`));
	}

	getSyncStatus(args: { id: string; envID?: EnvironmentID }): Promise<GitOpsSyncStatus> {
		return this.rest.get(this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}/status`));
	}

	browseSyncFiles(args: {
		id: string;
		path?: string;
		envID?: EnvironmentID;
	}): Promise<GitOpsBrowseResponse> {
		const query: QueryItem[] = [];
		if (args.path !== undefined) query.push(q('path', args.path));
		return this.rest.get(this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}/files`), {
			query
		});
	}

	importSyncs(args: {
		syncs: ImportGitOpsSyncRequest[];
		envID?: EnvironmentID;
	}): Promise<ImportGitOpsSyncResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'gitops-syncs/import'), {
			body: args.syncs
		});
	}

	previewBackup(args: { id: string; envID?: EnvironmentID }): Promise<GitBackupPreview> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}/backup/preview`)
		);
	}

	backupHistory(args: {
		id: string;
		limit?: number;
		envID?: EnvironmentID;
	}): Promise<GitBackupHistoryResponse> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}/backup/history`),
			{
				query: [q('limit', String(args.limit ?? 20))]
			}
		);
	}

	backupRevision(args: {
		id: string;
		commit: string;
		envID?: EnvironmentID;
	}): Promise<GitBackupRevision> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}/backup/history/${args.commit}`)
		);
	}

	resolveBackupConflict(args: {
		id: string;
		body?: ResolveGitBackupConflictRequest;
		envID?: EnvironmentID;
	}): Promise<GitOpsSyncResult> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}/backup/resolve`),
			{
				body: args.body ?? ResolveGitBackupConflictRequest.make()
			}
		);
	}
}
