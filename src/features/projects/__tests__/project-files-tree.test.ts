import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import type { ProjectFile } from '@/sdk/models/project/ProjectFiles';

import {
	childrenByParent,
	limitWorkspaceFiles,
	ProjectFileWorkspaceHelpers
} from '../project-files-model';

const file = (relativePath: string, isDirectory = false): ProjectFile => ({
	path: `/srv/${relativePath}`,
	relativePath,
	name: ProjectFileWorkspaceHelpers.basename(relativePath),
	isDirectory,
	size: 0
});

describe('childrenByParent', () => {
	it('groups entries under their parent folder in display order', () => {
		const entries = ProjectFileWorkspaceHelpers.apply(
			[
				file('data', true),
				file('config', true),
				file('notes.txt'),
				file('data/b.jpg'),
				file('data/a.jpg'),
				file('config/app.yml')
			],
			[]
		);
		const index = childrenByParent(entries);
		assert.deepEqual(
			index.get('')?.map((entry) => entry.relativePath),
			['config', 'data', 'notes.txt']
		);
		assert.deepEqual(
			index.get('data')?.map((entry) => entry.relativePath),
			['data/a.jpg', 'data/b.jpg']
		);
		assert.deepEqual(
			index.get('config')?.map((entry) => entry.relativePath),
			['config/app.yml']
		);
		assert.equal(index.get('missing'), undefined);
	});

	it('indexes a large folder in one pass', () => {
		const files = [
			file('data', true),
			...Array.from({ length: 5_000 }, (_, i) => file(`data/clip-${i}.mp4`))
		];
		const index = childrenByParent(ProjectFileWorkspaceHelpers.apply(files, []));
		assert.equal(index.get('data')?.length, 5_000);
		assert.equal(index.get('')?.length, 1);
	});
});

describe('limitWorkspaceFiles', () => {
	it('keeps a listing within the limit unchanged', () => {
		const result = limitWorkspaceFiles([1, 2, 3], 3, false);
		assert.deepEqual(result, { files: [1, 2, 3], truncated: false });
	});

	it('preserves the server truncation flag', () => {
		assert.equal(limitWorkspaceFiles([1], 10, true).truncated, true);
	});

	it('caps an oversized listing and marks it truncated', () => {
		const result = limitWorkspaceFiles([1, 2, 3, 4], 2, false);
		assert.deepEqual(result, { files: [1, 2], truncated: true });
	});
});
