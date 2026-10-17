/** Port of Models/Volume/VolumeWorkspace.swift. */
import type { ProjectWorkspace, ProjectWorkspaceFileContent } from '../project/ProjectFiles';

/** Volume and project workspaces share the server's workspace response contract. */
export type VolumeWorkspace = ProjectWorkspace;
export type VolumeWorkspaceFileContent = ProjectWorkspaceFileContent;

export type VolumeWorkspaceOperation =
	| 'create_file'
	| 'create_folder'
	| 'update_file'
	| 'rename'
	| 'move'
	| 'delete'
	| 'restore_file';

export const VolumeWorkspaceOperation = {
	createFile: 'create_file',
	createFolder: 'create_folder',
	updateFile: 'update_file',
	rename: 'rename',
	move: 'move',
	delete: 'delete',
	restoreFile: 'restore_file'
} as const satisfies Record<string, VolumeWorkspaceOperation>;

/** Upload indices refer to the ordered files passed to `updateWorkspace`. */
export interface VolumeWorkspaceFileChange {
	operation: VolumeWorkspaceOperation;
	relativePath: string;
	newName?: string;
	newParentPath?: string;
	uploadIndex?: number;
	baselineIndex?: number;
	backupId?: string;
	recursive?: boolean;
}

export interface VolumeWorkspaceUpdateManifest {
	fileTreeRevision: string;
	fileChanges: VolumeWorkspaceFileChange[];
}
