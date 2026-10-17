/** Port of Types/GitOps/GitOpsSyncAndBackup.swift. */
import type { ISODateString } from '../../models/base/date';

export interface GitRepositorySync {
	id: string;
	name: string;
	url: string;
	authType: string;
	username?: string;
	token?: string;
	sshKey?: string;
	sshHostKeyVerification?: string;
	description?: string;
	enabled: boolean;
	createdAt: ISODateString;
	updatedAt: ISODateString;
}

export interface GitRepositorySyncRequest {
	repositories: GitRepositorySync[];
}

export interface ImportGitOpsSyncRequest {
	syncName: string;
	gitRepo: string;
	branch: string;
	dockerComposePath: string;
	autoSync: boolean;
	syncInterval: number;
	syncDirectory?: boolean;
	maxSyncFiles?: number;
	maxSyncTotalSize?: number;
	maxSyncBinarySize?: number;
}

export interface ImportGitOpsSyncResponse {
	successCount: number;
	failedCount: number;
	errors: string[];
}

// MARK: - Git backup mode

export interface GitBackupFileChange {
	path: string;
	change: string;
}

export interface GitBackupPreview {
	state: string;
	remoteCommit?: string;
	changes: GitBackupFileChange[];
	conflicts: GitBackupFileChange[];
	files: string[];
}

export const GitBackupPreview = {
	make(args: {
		state: string;
		remoteCommit?: string;
		changes?: GitBackupFileChange[];
		conflicts?: GitBackupFileChange[];
		files?: string[];
	}): GitBackupPreview {
		return {
			state: args.state,
			remoteCommit: args.remoteCommit,
			changes: args.changes ?? [],
			conflicts: args.conflicts ?? [],
			files: args.files ?? []
		};
	}
} as const;

export interface GitBackupHistoryEntry {
	commit: string;
	author: string;
	message: string;
	date: ISODateString;
	files: string[];
}

export const GitBackupHistoryEntry = {
	make(args: {
		commit: string;
		author: string;
		message: string;
		date: ISODateString;
		files?: string[];
	}): GitBackupHistoryEntry {
		return { ...args, files: args.files ?? [] };
	}
} as const;

export interface GitBackupHistoryResponse {
	entries: GitBackupHistoryEntry[];
}

export const GitBackupHistoryResponse = {
	make(args: { entries?: GitBackupHistoryEntry[] } = {}): GitBackupHistoryResponse {
		return { entries: args.entries ?? [] };
	}
} as const;

export interface GitBackupFileDiff {
	path: string;
	patch: string;
}

export interface GitBackupRevision {
	entry: GitBackupHistoryEntry;
	diffs: GitBackupFileDiff[];
}

export const GitBackupRevision = {
	make(args: { entry: GitBackupHistoryEntry; diffs?: GitBackupFileDiff[] }): GitBackupRevision {
		return { entry: args.entry, diffs: args.diffs ?? [] };
	}
} as const;

export interface ResolveGitBackupConflictRequest {
	strategy: string;
}

export const ResolveGitBackupConflictRequest = {
	make(args: { strategy?: string } = {}): ResolveGitBackupConflictRequest {
		return { strategy: args.strategy ?? 'use_arcane' };
	}
} as const;
