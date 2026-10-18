import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { nextNavigationPath } from '../project-files-model';

describe('nextNavigationPath', () => {
	it('pushes a newly created file over the file list', () => {
		assert.deepEqual(nextNavigationPath([], 'files', 'files', 'file:notes.txt'), [
			'file:notes.txt'
		]);
	});

	it('replaces an open file when it is renamed', () => {
		assert.deepEqual(
			nextNavigationPath(['folder:config', 'file:a.txt'], 'files', 'file:a.txt', 'file:b.txt'),
			['folder:config', 'file:b.txt']
		);
	});

	it('returns to the root when the selection goes back to it', () => {
		assert.deepEqual(nextNavigationPath(['file:a.txt'], 'files', 'file:a.txt', 'files'), []);
	});

	it('leaves the path alone when nothing changed', () => {
		const path = ['file:a.txt'];
		assert.equal(nextNavigationPath(path, 'files', 'file:a.txt', 'file:a.txt'), path);
	});
});
