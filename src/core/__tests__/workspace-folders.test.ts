import { describe, expect, it } from 'vite-plus/test';

import { ProjectWorkspace } from '@/sdk/models/project/ProjectFiles';

import {
	assembleWorkspaceFolders,
	mergeWorkspaceFolder,
	workspaceFolderChain,
	workspaceServerPath
} from '../workspace-folders';

const entry = (relativePath: string, isDirectory = false) => ({ relativePath, isDirectory });
const paths = (files: readonly { relativePath: string }[]) =>
	files.map((file) => file.relativePath).sort();

describe('workspaceFolderChain', () => {
	it('lists every ancestor folder from the root down', () => {
		expect(workspaceFolderChain('a/b/c')).toEqual(['a', 'a/b', 'a/b/c']);
		expect(workspaceFolderChain('/a//b/')).toEqual(['a', 'a/b']);
		expect(workspaceFolderChain('')).toEqual([]);
	});
});

describe('mergeWorkspaceFolder', () => {
	it('adds a folder listing under the folder', () => {
		const merged = mergeWorkspaceFolder([entry('a', true), entry('b.txt')], 'a', [
			entry('a/x.txt'),
			entry('a/sub', true)
		]);
		expect(paths(merged)).toEqual(['a', 'a/sub', 'a/x.txt', 'b.txt']);
	});

	it('replaces stale children and keeps loaded subfolders that still exist', () => {
		const merged = mergeWorkspaceFolder(
			[
				entry('a', true),
				entry('a/old.txt'),
				entry('a/keep', true),
				entry('a/keep/deep.txt'),
				entry('a/gone', true),
				entry('a/gone/deep.txt'),
				entry('ab.txt')
			],
			'a',
			[entry('a/keep', true), entry('a/new.txt')]
		);
		expect(paths(merged)).toEqual(['a', 'a/keep', 'a/keep/deep.txt', 'a/new.txt', 'ab.txt']);
	});

	it('replaces root entries when refreshing the root', () => {
		const merged = mergeWorkspaceFolder(
			[entry('a', true), entry('a/x.txt'), entry('b', true), entry('b/y.txt'), entry('c.txt')],
			'',
			[entry('a', true), entry('d.txt')]
		);
		expect(paths(merged)).toEqual(['a', 'a/x.txt', 'd.txt']);
	});
});

describe('assembleWorkspaceFolders', () => {
	it('merges listings by depth and drops folders whose parent is missing', () => {
		const result = assembleWorkspaceFolders([
			{ path: 'a/b', files: [entry('a/b/c.txt')] },
			{ path: 'gone', files: [entry('gone/x.txt')] },
			{ path: '', files: [entry('a', true)], truncated: false },
			{ path: 'a', files: [entry('a/b', true)], truncated: true }
		]);
		expect(paths(result.files)).toEqual(['a', 'a/b', 'a/b/c.txt']);
		expect(result.loaded).toEqual(['', 'a', 'a/b']);
		expect(result.truncated).toBe(true);
	});
});

describe('workspaceServerPath', () => {
	it('maps displayed paths back through staged renames and moves', () => {
		const changes = [
			{ operation: 'rename', relativePath: 'a', newName: 'b' },
			{ operation: 'move', relativePath: 'b/c', newParentPath: 'x' }
		];
		expect(workspaceServerPath(changes, 'b')).toBe('a');
		expect(workspaceServerPath(changes, 'b/d')).toBe('a/d');
		expect(workspaceServerPath(changes, 'x/c')).toBe('a/c');
		expect(workspaceServerPath(changes, 'x/c/e')).toBe('a/c/e');
		expect(workspaceServerPath(changes, 'other')).toBe('other');
	});

	it('returns null for folders created by staged changes', () => {
		const changes = [
			{ operation: 'delete', relativePath: 'a' },
			{ operation: 'create_folder', relativePath: 'n' }
		];
		expect(workspaceServerPath(changes, 'n')).toBeNull();
		expect(workspaceServerPath(changes, 'a')).toBeNull();
		expect(workspaceServerPath(changes, '')).toBe('');
	});
});

describe('ProjectWorkspace', () => {
	it('builds the folder query only for subfolders', () => {
		expect(ProjectWorkspace.folderQuery(undefined)).toEqual([]);
		expect(ProjectWorkspace.folderQuery('')).toEqual([]);
		expect(ProjectWorkspace.folderQuery('/a/b/')).toEqual([{ name: 'path', value: 'a/b' }]);
	});

	it('decodes v3 listings without a revision and ignores message update responses', () => {
		expect(
			ProjectWorkspace.decode({ files: [], fileTreeRevision: '', fileTreeTruncated: false })
				.fileTreeRevision
		).toBe('');
		expect(ProjectWorkspace.decode({ files: [], fileTreeTruncated: true }).fileTreeRevision).toBe(
			''
		);
		expect(
			ProjectWorkspace.decodeUpdate({ message: 'Volume workspace updated successfully' })
		).toBeUndefined();
		expect(
			ProjectWorkspace.decodeUpdate({ files: [], fileTreeRevision: 'r1', fileTreeTruncated: false })
				?.fileTreeRevision
		).toBe('r1');
	});
});
