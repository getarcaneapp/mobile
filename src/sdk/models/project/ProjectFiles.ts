import { D } from '../base/decoding';
import type { ISODateString } from '../base/date';

export interface ProjectFile {
	path: string;
	relativePath: string;
	name: string;
	isDirectory: boolean;
	size: number;
	modTime?: ISODateString;
	protected?: boolean;
	isSymlink?: boolean;
	editable?: boolean;
	readOnlyReason?: string;
	content?: string;
}

export const ProjectFile = {
	make(args: Omit<ProjectFile, 'size'> & { size?: number }): ProjectFile {
		return { ...args, size: args.size ?? 0 };
	}
} as const;

export interface ProjectWorkspace {
	files: ProjectFile[];
	fileTreeRevision: string;
	fileTreeTruncated: boolean;
	activityID?: string;
}

export const ProjectWorkspace = {
	make(
		this: void,
		args: {
			files: ProjectFile[];
			fileTreeRevision: string;
			fileTreeTruncated?: boolean;
			activityID?: string;
		}
	): ProjectWorkspace {
		return {
			files: args.files,
			fileTreeRevision: args.fileTreeRevision,
			fileTreeTruncated: args.fileTreeTruncated ?? false,
			activityID: args.activityID
		};
	},

	decode(this: void, raw: unknown): ProjectWorkspace {
		const o = D.object(raw, 'ProjectWorkspace');
		return {
			files: D.array(o, 'files', D.cast<ProjectFile>),
			fileTreeRevision: D.string(o, 'fileTreeRevision'),
			fileTreeTruncated: D.boolean(o, 'fileTreeTruncated'),
			activityID: D.optString(o, 'activityId')
		};
	},

	encode(this: void, value: ProjectWorkspace): Record<string, unknown> {
		return {
			files: value.files,
			fileTreeRevision: value.fileTreeRevision,
			fileTreeTruncated: value.fileTreeTruncated,
			activityId: value.activityID
		};
	}
} as const;

export interface ProjectWorkspaceFileContent {
	path: string;
	relativePath: string;
	name: string;
	content?: string;
	mimeType?: string;
	size: number;
	editable?: boolean;
	readOnlyReason?: string;
}

export const ProjectWorkspaceFileContent = {
	make(
		args: Omit<ProjectWorkspaceFileContent, 'size'> & { size?: number }
	): ProjectWorkspaceFileContent {
		return { ...args, size: args.size ?? 0 };
	}
} as const;

export interface ProjectFileDraft {
	relativePath: string;
	isDirectory: boolean;
	content?: string;
}

export const ProjectFileDraft = {
	make(args: { relativePath: string; isDirectory?: boolean; content?: string }): ProjectFileDraft {
		return {
			relativePath: args.relativePath,
			isDirectory: args.isDirectory ?? false,
			content: args.content
		};
	}
} as const;

export type ProjectFileChangeOperation =
	| 'create_file'
	| 'create_folder'
	| 'update_file'
	| 'rename'
	| 'move'
	| 'delete';

export const ProjectFileChangeOperation = {
	createFile: 'create_file',
	createFolder: 'create_folder',
	updateFile: 'update_file',
	rename: 'rename',
	move: 'move',
	delete: 'delete'
} as const satisfies Record<string, ProjectFileChangeOperation>;

export interface ProjectFileChange {
	operation: ProjectFileChangeOperation;
	relativePath: string;
	newName?: string;
	newParentPath?: string;
	content?: string;
	recursive?: boolean;
}
