import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { isEchoOfEmittedText, rememberEmittedText } from '../synced-native-text.types';

describe('synced native text', () => {
	it('ignores stale renders of text the field already emitted', () => {
		const pending: string[] = [];
		for (const text of ['h', 'ht', 'htt']) rememberEmittedText(pending, text);
		assert.equal(isEchoOfEmittedText(pending, 'h'), true);
		assert.equal(isEchoOfEmittedText(pending, 'ht'), true);
		assert.equal(isEchoOfEmittedText(pending, 'htt'), true);
		assert.deepEqual(pending, []);
	});

	it('treats a value the field never emitted as an external change', () => {
		const pending: string[] = [];
		rememberEmittedText(pending, 'a');
		assert.equal(isEchoOfEmittedText(pending, 'reset'), false);
	});

	it('keeps at most 64 pending echoes', () => {
		const pending: string[] = [];
		for (let i = 0; i < 100; i += 1) rememberEmittedText(pending, String(i));
		assert.equal(pending.length, 64);
		assert.equal(pending[0], '36');
	});
});
