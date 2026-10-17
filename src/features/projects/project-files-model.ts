/**
 * Port of `ProjectFileWorkspaceHelpers`, `ManagedProjectFileEntry`,
 * `ProjectFilesWorkspaceDestination`, and the file-dialog models from
 * ProjectFilesWorkspaceView.swift. Pure TS.
 */
import type { ProjectFile, ProjectFileChange } from '@/sdk/models/project/ProjectFiles';

import { localizedStandardCompare } from '@/features/containers/container-model';

/** `ProjectFilesWorkspaceDestination`, encoded as a string so it can travel as a route param / SwiftUI path value. */
export type ProjectFilesDestination =
	| { kind: 'compose' }
	| { kind: 'env' }
	| { kind: 'files' }
	| { kind: 'folder'; path: string }
	| { kind: 'managedFile'; path: string };

export function encodeDestination(destination: ProjectFilesDestination): string {
	switch (destination.kind) {
		case 'compose':
		case 'env':
		case 'files':
			return destination.kind;
		case 'folder':
			return `folder:${destination.path}`;
		case 'managedFile':
			return `file:${destination.path}`;
	}
}

export function decodeDestination(value: string | undefined): ProjectFilesDestination {
	if (value === 'compose' || value === 'env' || value === 'files') return { kind: value };
	if (value?.startsWith('folder:')) return { kind: 'folder', path: value.slice('folder:'.length) };
	if (value?.startsWith('file:')) return { kind: 'managedFile', path: value.slice('file:'.length) };
	return { kind: 'files' };
}

export const sameDestination = (a: ProjectFilesDestination, b: ProjectFilesDestination) =>
	encodeDestination(a) === encodeDestination(b);

/** `EditorLanguage`. */
export type EditorLanguage = 'yaml' | 'env' | 'plaintext';

export type ManagedProjectFileEntry = {
	id: string;
	path: string;
	relativePath: string;
	name: string;
	isDirectory: boolean;
	size: number;
	protected?: boolean;
	pending: boolean;
	depth: number;
};

export const isProtectedEntry = (entry: ManagedProjectFileEntry) => entry.protected === true;

const reservedRootNames = new Set([
	'.env',
	'.env.git',
	'project.env',
	'compose.yaml',
	'compose.yml',
	'docker-compose.yaml',
	'docker-compose.yml'
]);

function normalize(relativePath: string): string {
	return relativePath
		.trim()
		.replaceAll('\\', '/')
		.split('/')
		.filter((part) => part !== '')
		.join('/');
}

function join(parent: string, name: string): string {
	const normalized = normalize(parent);
	return normalized === '' ? name : `${normalized}/${name}`;
}

function depth(relativePath: string): number {
	const normalized = normalize(relativePath);
	if (normalized === '') return 0;
	return Math.max(0, normalized.split('/').length - 1);
}

function makeEntry(args: Omit<ManagedProjectFileEntry, 'id'>): ManagedProjectFileEntry {
	return { id: args.relativePath, ...args };
}

export const ProjectFileWorkspaceHelpers = {
	apply(
		projectFiles: readonly ProjectFile[],
		changes: readonly ProjectFileChange[]
	): ManagedProjectFileEntry[] {
		const entries = new Map<string, ManagedProjectFileEntry>();
		for (const file of projectFiles) {
			entries.set(
				file.relativePath,
				makeEntry({
					path: file.path,
					relativePath: file.relativePath,
					name:
						file.name === '' ? ProjectFileWorkspaceHelpers.basename(file.relativePath) : file.name,
					isDirectory: file.isDirectory,
					size: file.size,
					protected: file.protected ?? file.editable === false,
					pending: false,
					depth: depth(file.relativePath)
				})
			);
		}

		for (const change of changes) {
			const relativePath = normalize(change.relativePath);
			switch (change.operation) {
				case 'create_file':
					entries.set(
						relativePath,
						makeEntry({
							path: relativePath,
							relativePath,
							name: ProjectFileWorkspaceHelpers.basename(relativePath),
							isDirectory: false,
							size: change.content?.length ?? 0,
							protected: false,
							pending: true,
							depth: depth(relativePath)
						})
					);
					break;
				case 'create_folder':
					entries.set(
						relativePath,
						makeEntry({
							path: relativePath,
							relativePath,
							name: ProjectFileWorkspaceHelpers.basename(relativePath),
							isDirectory: true,
							size: 0,
							protected: false,
							pending: true,
							depth: depth(relativePath)
						})
					);
					break;
				case 'update_file': {
					const entry = entries.get(relativePath);
					if (entry) entries.set(relativePath, { ...entry, pending: true });
					break;
				}
				case 'rename': {
					if (change.newName === undefined) continue;
					const parent = ProjectFileWorkspaceHelpers.parentPath(relativePath);
					remapEntries(entries, relativePath, join(parent, change.newName));
					break;
				}
				case 'move': {
					const parent = normalize(change.newParentPath ?? '');
					remapEntries(
						entries,
						relativePath,
						join(parent, ProjectFileWorkspaceHelpers.basename(relativePath))
					);
					break;
				}
				case 'delete':
					for (const path of entries.keys()) {
						if (ProjectFileWorkspaceHelpers.pathMatches(path, relativePath)) entries.delete(path);
					}
					break;
			}
		}

		return [...entries.values()].sort((lhs, rhs) =>
			browserSort(lhs, rhs, entries) ? -1 : browserSort(rhs, lhs, entries) ? 1 : 0
		);
	},

	language(relativePath: string): EditorLanguage {
		const lower = relativePath.toLowerCase();
		const base = ProjectFileWorkspaceHelpers.basename(lower);
		if (lower.endsWith('.env') || base.startsWith('.env')) return 'env';
		if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
		return 'plaintext';
	},

	planCreate(
		existingPaths: ReadonlySet<string>,
		parentPath: string,
		name: string,
		composeFileName: string
	): string | undefined {
		const validName = validateFileName(name, parentPath, composeFileName);
		if (validName === undefined) return undefined;
		const relativePath = join(parentPath, validName);
		return existingPaths.has(relativePath) ? undefined : relativePath;
	},

	planRename(
		existingPaths: ReadonlySet<string>,
		relativePath: string,
		newName: string,
		composeFileName: string
	): { newName: string; newPath: string } | undefined {
		const parent = ProjectFileWorkspaceHelpers.parentPath(relativePath);
		const validName = validateFileName(newName, parent, composeFileName);
		if (validName === undefined) return undefined;
		const newPath = join(parent, validName);
		if (newPath !== relativePath && existingPaths.has(newPath)) return undefined;
		return { newName: validName, newPath };
	},

	planMove(
		entry: ManagedProjectFileEntry,
		existingPaths: ReadonlySet<string>,
		relativePath: string,
		newParentPath: string
	): string | undefined {
		const parent = normalize(newParentPath);
		if (parent === ProjectFileWorkspaceHelpers.parentPath(relativePath)) return undefined;
		if (
			entry.isDirectory &&
			parent !== '' &&
			ProjectFileWorkspaceHelpers.pathMatches(parent, relativePath)
		)
			return undefined;
		const newPath = join(parent, ProjectFileWorkspaceHelpers.basename(relativePath));
		if (newPath !== relativePath && existingPaths.has(newPath)) return undefined;
		return newPath;
	},

	basename(relativePath: string): string {
		const normalized = normalize(relativePath);
		const slash = normalized.lastIndexOf('/');
		return slash < 0 ? normalized : normalized.slice(slash + 1);
	},

	parentPath(relativePath: string): string {
		const normalized = normalize(relativePath);
		const slash = normalized.lastIndexOf('/');
		return slash < 0 ? '' : normalized.slice(0, slash);
	},

	pathMatches(path: string, root: string): boolean {
		return path === root || path.startsWith(`${root}/`);
	},

	remapRecord<T>(record: Record<string, T>, oldPath: string, newPath: string): Record<string, T> {
		const result: Record<string, T> = {};
		for (const [path, value] of Object.entries(record)) {
			const key = ProjectFileWorkspaceHelpers.pathMatches(path, oldPath)
				? `${newPath}${path.slice(oldPath.length)}`
				: path;
			result[key] = value;
		}
		return result;
	},

	removeRecord<T>(record: Record<string, T>, root: string): Record<string, T> {
		const result: Record<string, T> = {};
		for (const [path, value] of Object.entries(record)) {
			if (!ProjectFileWorkspaceHelpers.pathMatches(path, root)) result[path] = value;
		}
		return result;
	}
};

function validateFileName(
	name: string,
	parentPath: string,
	composeFileName: string
): string | undefined {
	const trimmed = name.trim();
	if (trimmed === '' || trimmed === '.' || trimmed === '..') return undefined;
	if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) return undefined;
	const lower = trimmed.toLowerCase();
	if (
		parentPath === '' &&
		(lower === composeFileName.toLowerCase() || reservedRootNames.has(lower))
	)
		return undefined;
	return trimmed;
}

/** `browserSort`: true when `lhs` sorts before `rhs`. Folders first, then Finder order. */
function browserSort(
	lhs: ManagedProjectFileEntry,
	rhs: ManagedProjectFileEntry,
	entries: ReadonlyMap<string, ManagedProjectFileEntry>
): boolean {
	if (lhs.relativePath === rhs.relativePath) return false;
	if (ProjectFileWorkspaceHelpers.pathMatches(rhs.relativePath, lhs.relativePath)) return true;
	if (ProjectFileWorkspaceHelpers.pathMatches(lhs.relativePath, rhs.relativePath)) return false;

	const lhsParts = lhs.relativePath.split('/').filter((p) => p !== '');
	const rhsParts = rhs.relativePath.split('/').filter((p) => p !== '');
	const sharedCount = Math.min(lhsParts.length, rhsParts.length);
	for (let index = 0; index < sharedCount; index++) {
		if (lhsParts[index] === rhsParts[index]) continue;
		const lhsPath = lhsParts.slice(0, index + 1).join('/');
		const rhsPath = rhsParts.slice(0, index + 1).join('/');
		const lhsIsDirectory = entries.get(lhsPath)?.isDirectory === true;
		const rhsIsDirectory = entries.get(rhsPath)?.isDirectory === true;
		if (lhsIsDirectory !== rhsIsDirectory) return lhsIsDirectory;
		return localizedStandardCompare(lhsParts[index] ?? '', rhsParts[index] ?? '') < 0;
	}
	return lhsParts.length < rhsParts.length;
}

function remapEntries(
	entries: Map<string, ManagedProjectFileEntry>,
	oldPath: string,
	newPath: string
) {
	const remapped = new Map<string, ManagedProjectFileEntry>();
	for (const [path, entry] of entries) {
		if (ProjectFileWorkspaceHelpers.pathMatches(path, oldPath)) {
			const movedPath = `${newPath}${path.slice(oldPath.length)}`;
			remapped.set(
				movedPath,
				makeEntry({
					path: movedPath,
					relativePath: movedPath,
					name: ProjectFileWorkspaceHelpers.basename(movedPath),
					isDirectory: entry.isDirectory,
					size: entry.size,
					protected: entry.protected,
					pending: true,
					depth: depth(movedPath)
				})
			);
		} else {
			remapped.set(path, entry);
		}
	}
	entries.clear();
	for (const [key, value] of remapped) entries.set(key, value);
}

// MARK: - File dialog (ProjectFileDialog / ProjectFileDialogResult)

export type ProjectFileDialog =
	| { kind: 'createFile'; parentPath: string }
	| { kind: 'createFolder'; parentPath: string }
	| { kind: 'rename'; path: string; currentName: string }
	| { kind: 'move'; path: string };

export type ProjectFileDialogResult =
	| { kind: 'createFile'; parentPath: string; name: string }
	| { kind: 'createFolder'; parentPath: string; name: string }
	| { kind: 'rename'; path: string; newName: string }
	| { kind: 'move'; path: string; newParentPath: string };

export const ProjectFileDialogInfo = {
	id(dialog: ProjectFileDialog): string {
		switch (dialog.kind) {
			case 'createFile':
				return `create-file:${dialog.parentPath}`;
			case 'createFolder':
				return `create-folder:${dialog.parentPath}`;
			case 'rename':
				return `rename:${dialog.path}`;
			case 'move':
				return `move:${dialog.path}`;
		}
	},
	title: (dialog: ProjectFileDialog) =>
		({ createFile: 'New File', createFolder: 'New Folder', rename: 'Rename', move: 'Move' })[
			dialog.kind
		],
	actionTitle: (dialog: ProjectFileDialog) =>
		({ createFile: 'Create', createFolder: 'Create', rename: 'Rename', move: 'Move' })[dialog.kind],
	initialName: (dialog: ProjectFileDialog) => (dialog.kind === 'rename' ? dialog.currentName : ''),
	initialDestination(dialog: ProjectFileDialog): string {
		switch (dialog.kind) {
			case 'createFile':
			case 'createFolder':
				return dialog.parentPath;
			case 'move':
				return ProjectFileWorkspaceHelpers.parentPath(dialog.path);
			case 'rename':
				return '';
		}
	},
	needsName: (dialog: ProjectFileDialog) => dialog.kind !== 'move',
	needsDestination: (dialog: ProjectFileDialog) => dialog.kind !== 'rename',
	nameSectionTitle: (dialog: ProjectFileDialog) =>
		({ createFile: 'File Name', createFolder: 'Folder Name', rename: 'New Name', move: '' })[
			dialog.kind
		],
	namePlaceholder: (dialog: ProjectFileDialog) =>
		({ createFile: 'config.yaml', createFolder: 'config', rename: 'name', move: '' })[dialog.kind],

	/** `moveDestinationFolders`. */
	moveDestinationFolders(
		dialog: ProjectFileDialog,
		folders: readonly ManagedProjectFileEntry[]
	): ManagedProjectFileEntry[] {
		return folders.filter((folder) => {
			if (dialog.kind !== 'move') return true;
			const entry = folders.find((f) => f.relativePath === dialog.path);
			if (
				entry?.isDirectory === true &&
				ProjectFileWorkspaceHelpers.pathMatches(folder.relativePath, dialog.path)
			)
				return false;
			return folder.relativePath !== dialog.path;
		});
	},

	result(
		dialog: ProjectFileDialog,
		name: string,
		destinationPath: string
	): ProjectFileDialogResult {
		switch (dialog.kind) {
			case 'createFile':
				return { kind: 'createFile', parentPath: destinationPath, name };
			case 'createFolder':
				return { kind: 'createFolder', parentPath: destinationPath, name };
			case 'rename':
				return { kind: 'rename', path: dialog.path, newName: name };
			case 'move':
				return { kind: 'move', path: dialog.path, newParentPath: destinationPath };
		}
	}
};

/** `browserRowDetail` byte formatting: `ByteCountFormatter` `.file` style. */
export { formatFileBytes } from '@/core/networking/remote-data-limits';
