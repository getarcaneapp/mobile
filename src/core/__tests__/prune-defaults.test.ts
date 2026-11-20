import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { agreedPruneDefaults } from '../prune-defaults';

const values = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe('prune defaults', () => {
	it('uses the saved settings of a single agent', () => {
		assert.deepEqual(
			agreedPruneDefaults([values({ pruneImageMode: 'all', pruneImageUntil: '', other: 'x' })]),
			{ pruneImageMode: 'all', pruneImageUntil: '' }
		);
	});

	it('keeps only the groups every agent agrees on', () => {
		assert.deepEqual(
			agreedPruneDefaults([
				values({ pruneImageMode: 'olderThan', pruneImageUntil: '24h', pruneVolumeMode: 'none' }),
				values({ pruneImageMode: 'olderThan', pruneImageUntil: '48h', pruneVolumeMode: 'none' })
			]),
			{ pruneVolumeMode: 'none' }
		);
		assert.deepEqual(agreedPruneDefaults([]), {});
	});
});
