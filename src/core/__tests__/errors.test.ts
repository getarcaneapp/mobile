import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { friendlyErrorMessage, shouldRefreshNetworkSession } from '../errors';
import { ArcaneError, CancellationError } from '../../sdk/errors/ArcaneError';

describe('friendlyErrorMessage', () => {
	it('maps transport and decoding failures', () => {
		assert.equal(
			friendlyErrorMessage(ArcaneError.transport('Network request failed')),
			"Can't reach the server — check the address and that it's running."
		);
		assert.equal(
			friendlyErrorMessage(ArcaneError.transport('The request timed out.')),
			'Connection timed out — check the address and your network.'
		);
		assert.match(
			friendlyErrorMessage(ArcaneError.decoding("JSON Parse error: Unexpected character '<'")),
			/webpage/
		);
		assert.equal(friendlyErrorMessage(new CancellationError()), 'Cancelled');
	});
	it('summarizes validation errors', () => {
		assert.equal(
			friendlyErrorMessage(ArcaneError.validation({ 'body.name': ['is required'] })),
			'Name: is required'
		);
	});
});

describe('shouldRefreshNetworkSession', () => {
	it('is true only for transient transport failures', () => {
		assert.ok(shouldRefreshNetworkSession(ArcaneError.transport('Network request failed')));
		assert.ok(!shouldRefreshNetworkSession(ArcaneError.transport('certificate invalid')));
		assert.ok(!shouldRefreshNetworkSession(ArcaneError.unauthorized()));
	});
});
