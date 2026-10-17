/** Port of Services/GitOpsService.swift. */
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

/** GitOpsService manages Git repositories and GitOps sync configurations. */
export class GitOpsService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	// MARK: - Git repositories (top-level)

	/** List configured git repositories with pagination. */
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

	/** Get a git repository by ID. */
	getRepository(args: { id: string }): Promise<GitRepository> {
		return this.rest.get(`customize/git-repositories/${args.id}`);
	}

	/** Create a new git repository configuration. */
	createRepository(args: { body: CreateGitRepository }): Promise<GitRepository> {
		return this.rest.post('customize/git-repositories', { body: args.body });
	}

	/** Update an existing git repository. */
	updateRepository(args: { id: string; body: UpdateGitRepository }): Promise<GitRepository> {
		return this.rest.put(`customize/git-repositories/${args.id}`, { body: args.body });
	}

	/** Delete a git repository configuration. */
	deleteRepository(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`customize/git-repositories/${args.id}`);
	}

	/** Test connectivity and authentication for a git repository. */
	testRepository(args: { id: string; branch?: string }): Promise<void> {
		const query: QueryItem[] = [];
		if (args.branch !== undefined) query.push(q('branch', args.branch));
		return this.rest.postVoid(`customize/git-repositories/${args.id}/test`, { query });
	}

	/** List branches available in a git repository. */
	listBranches(args: { id: string }): Promise<GitOpsBranchesResponse> {
		return this.rest.get(`customize/git-repositories/${args.id}/branches`);
	}

	/** Browse files and directories in a git repository at the given branch. */
	browseRepositoryFiles(args: {
		id: string;
		branch: string;
		path?: string;
	}): Promise<GitOpsBrowseResponse> {
		const query: QueryItem[] = [q('branch', args.branch)];
		if (args.path !== undefined) query.push(q('path', args.path));
		return this.rest.get(`customize/git-repositories/${args.id}/files`, { query });
	}

	/** Sync git repositories from a manager to an agent instance. */
	syncRepositories(args: { body: GitRepositorySyncRequest }): Promise<void> {
		return this.rest.postVoid('git-repositories/sync', { body: args.body });
	}

	// MARK: - GitOps syncs (per environment)

	/** List GitOps syncs in the given environment with pagination. */
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

	/** Create a new GitOps sync configuration. */
	createSync(args: { body: CreateGitOpsSync; envID?: EnvironmentID }): Promise<GitOpsSync> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'gitops-syncs'), {
			body: args.body
		});
	}

	/** Get a GitOps sync by ID. */
	getSync(args: { id: string; envID?: EnvironmentID }): Promise<GitOpsSync> {
		return this.rest.get(this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}`));
	}

	/** Update an existing GitOps sync. */
	updateSync(args: {
		id: string;
		body: UpdateGitOpsSync;
		envID?: EnvironmentID;
	}): Promise<GitOpsSync> {
		return this.rest.put(this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}`), {
			body: args.body
		});
	}

	/** Delete a GitOps sync. */
	deleteSync(args: { id: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}`));
	}

	/** Manually trigger a sync operation. */
	performSync(args: { id: string; envID?: EnvironmentID }): Promise<GitOpsSyncResult> {
		return this.rest.post(this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}/sync`));
	}

	/** Get the current status of a GitOps sync. */
	getSyncStatus(args: { id: string; envID?: EnvironmentID }): Promise<GitOpsSyncStatus> {
		return this.rest.get(this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}/status`));
	}

	/** Browse files in a synced repository. */
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

	/** Import multiple GitOps syncs from a JSON list. */
	importSyncs(args: {
		syncs: ImportGitOpsSyncRequest[];
		envID?: EnvironmentID;
	}): Promise<ImportGitOpsSyncResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'gitops-syncs/import'), {
			body: args.syncs
		});
	}

	// MARK: - Git backup mode

	/** Preview what the next Git backup would commit. */
	previewBackup(args: { id: string; envID?: EnvironmentID }): Promise<GitBackupPreview> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}/backup/preview`)
		);
	}

	/** List repository revisions affecting a backup directory. */
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

	/** Get one backup revision with per-file diffs. */
	backupRevision(args: {
		id: string;
		commit: string;
		envID?: EnvironmentID;
	}): Promise<GitBackupRevision> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `gitops-syncs/${args.id}/backup/history/${args.commit}`)
		);
	}

	/** Resolve a backup that needs attention. */
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
