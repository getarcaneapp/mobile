import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { eventRedundantDescription, readableEventText } from '../event-text';

const digest = '14aeae146b7bf16c670624eedaf8fdc29664aba4607d45626b4f54483c7f78c2';

describe('readable event text', () => {
	it('shortens image digests and ids', () => {
		assert.equal(
			readableEventText(`Docker image delete: sha256:${digest}`),
			'Docker image delete: sha256:14aeae146b7b…'
		);
		assert.equal(readableEventText('Container web started'), 'Container web started');
	});

	it('hides a description that repeats the title', () => {
		const event = (description?: string) => ({ title: 'Image pulled', description });
		assert.equal(eventRedundantDescription(event()), true);
		assert.equal(eventRedundantDescription(event('image pulled')), true);
		assert.equal(eventRedundantDescription(event('nginx:latest pulled in 4s')), false);
	});
});
