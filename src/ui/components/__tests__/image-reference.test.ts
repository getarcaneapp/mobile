import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { imageReferenceParts } from '../image-reference';

describe('imageReferenceParts', () => {
	it('prefers the tag over a pinned digest', () => {
		assert.deepEqual(imageReferenceParts('nginx:alpine@sha256:892bb2152464f0c5d8972593'), {
			namespace: '',
			name: 'nginx',
			tag: 'alpine'
		});
	});

	it('shows a short digest when there is no tag', () => {
		assert.deepEqual(imageReferenceParts('cgr.dev/chainguard/minio@sha256:d7c906993247aa'), {
			namespace: 'cgr.dev/chainguard/',
			name: 'minio',
			tag: 'd7c906993247'
		});
	});

	it('keeps registry ports out of the tag', () => {
		assert.deepEqual(imageReferenceParts('localhost:5000/app'), {
			namespace: 'localhost:5000/',
			name: 'app',
			tag: undefined
		});
	});
});
