import assert from 'node:assert/strict';
import { describe, it, vi } from 'vite-plus/test';

import { goDurationSeconds, updaterDurationText } from '../updates-logic';

vi.mock('@/theme/colors', () => ({ systemColors: {} }));

describe('updater duration', () => {
	it('parses Go duration strings', () => {
		assert.ok(Math.abs((goDurationSeconds('106.059667ms') ?? 0) - 0.106059667) < 1e-9);
		assert.equal(goDurationSeconds('1m30.5s'), 90.5);
		assert.equal(goDurationSeconds('2h3m'), 7380);
		assert.equal(goDurationSeconds('soon'), undefined);
	});

	it('formats durations for the completion summary', () => {
		assert.equal(updaterDurationText('106.059667ms'), 'under 1s');
		assert.equal(updaterDurationText('1m30.5s'), '1m 31s');
		assert.equal(updaterDurationText('unknown'), 'unknown');
	});
});
