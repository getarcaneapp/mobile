/** Port of Models/GitOps/GitOps.swift. */
import type { ISODateString } from '../base/date';

export interface GitRepository {
	id: string;
	name: string;
	url: string;
	authType: string;
	username?: string;
	sshHostKeyVerification?: string;
	description?: string;
	enabled: boolean;
	createdAt: ISODateString;
	updatedAt: ISODateString;
}

export interface CreateGitRepository {
	name: string;
	url: string;
	authType: string;
	username?: string;
	token?: string;
	sshKey?: string;
	sshHostKeyVerification?: string;
	description?: string;
	enabled?: boolean;
}

export interface UpdateGitRepository {
	name?: string;
	url?: string;
	authType?: string;
	username?: string;
	token?: string;
	sshKey?: string;
	sshHostKeyVerification?: string;
	description?: string;
	enabled?: boolean;
}

export interface GitOpsSync {
	id: string;
	name: string;
	environmentId: string;
	repositoryId: string;
	repository?: GitRepository;
	branch: string;
	composePath: string;
	targetType: string;
	projectName: string;
	projectId?: string;
	autoSync: boolean;
	syncInterval: number;
	syncDirectory: boolean;
	syncedFiles?: string;
	maxSyncFiles: number;
	maxSyncTotalSize: number;
	maxSyncBinarySize: number;
	lastSyncAt?: ISODateString;
	lastSyncStatus?: string;
	lastSyncError?: string;
	lastSyncCommit?: string;
	mode?: string;
	backupDirectory?: string;
	backupPaths?: string[];
	backupState?: string;
	backupFailureReason?: string;
	lastBackupAt?: ISODateString;
	pullImageAfterSync?: boolean;
	redeployAfterSync?: boolean;
	backupOnSave?: boolean;
	backupPending?: boolean;
	createdAt: ISODateString;
	updatedAt: ISODateString;
}

export const GitOpsSync = {
	isBackup(sync: GitOpsSync): boolean {
		return sync.mode === 'backup';
	}
} as const;

export interface GitOpsSyncCounts {
	totalSyncs: number;
	activeSyncs: number;
	successfulSyncs: number;
	deploySyncs?: number;
	backupSyncs?: number;
}

export interface CreateGitOpsSync {
	name: string;
	repositoryId: string;
	branch: string;
	composePath: string;
	targetType?: string;
	projectName?: string;
	projectId?: string;
	mode?: string;
	backupDirectory?: string;
	backupPaths?: string[];
	backupOnSave?: boolean;
	pullImageAfterSync?: boolean;
	redeployAfterSync?: boolean;
	autoSync?: boolean;
	syncInterval?: number;
	syncDirectory?: boolean;
	maxSyncFiles?: number;
	maxSyncTotalSize?: number;
	maxSyncBinarySize?: number;
}

export interface UpdateGitOpsSync {
	name?: string;
	repositoryId?: string;
	branch?: string;
	composePath?: string;
	targetType?: string;
	projectName?: string;
	projectId?: string;
	mode?: string;
	backupDirectory?: string;
	backupPaths?: string[];
	backupOnSave?: boolean;
	pullImageAfterSync?: boolean;
	redeployAfterSync?: boolean;
	autoSync?: boolean;
	syncInterval?: number;
	syncDirectory?: boolean;
	maxSyncFiles?: number;
	maxSyncTotalSize?: number;
	maxSyncBinarySize?: number;
}

export interface GitOpsSyncResult {
	success: boolean;
	message: string;
	error?: string;
	syncedAt: ISODateString;
}

export type GitOpsFileTreeNodeType = 'file' | 'directory';

export const GitOpsFileTreeNodeType = {
	file: 'file',
	directory: 'directory'
} as const satisfies Record<string, GitOpsFileTreeNodeType>;

export interface GitOpsFileTreeNode {
	name: string;
	path: string;
	type: GitOpsFileTreeNodeType;
	size?: number;
	children?: GitOpsFileTreeNode[];
}

export interface GitOpsBrowseResponse {
	path: string;
	files: GitOpsFileTreeNode[];
}

export interface GitOpsBranchInfo {
	name: string;
	isDefault: boolean;
}

export interface GitOpsBranchesResponse {
	branches: GitOpsBranchInfo[];
}

export interface GitOpsSyncStatus {
	id: string;
	autoSync: boolean;
	nextSyncAt?: ISODateString;
	lastSyncAt?: ISODateString;
	lastSyncStatus?: string;
	lastSyncError?: string;
	lastSyncCommit?: string;
}
