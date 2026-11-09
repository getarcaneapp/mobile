import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	canonicalServerOrigin,
	isSameOrigin,
	normalizeServerURLInput,
	serverCacheIdentity
} from '../../core/networking/server-identity';
import { ProxyRequestSupport } from '../client/proxyRequestSupport';
import { appendingAPIPath, baseQuery, webSocketURL, withQueryItems } from '../client/url';

describe('server URL query parameters', () => {
	it('keeps the configured query on API paths', () => {
		assert.equal(
			appendingAPIPath('https://arcane.test/?p_token=abc', 'auth/me'),
			'https://arcane.test/api/auth/me?p_token=abc'
		);
		assert.equal(
			appendingAPIPath('https://arcane.test/arcane?a=1&b=2#frag', '/environments/0/'),
			'https://arcane.test/arcane/api/environments/0?a=1&b=2'
		);
		assert.equal(
			appendingAPIPath('https://arcane.test/arcane/api/?t=x', 'auth/refresh'),
			'https://arcane.test/arcane/api/auth/refresh?t=x'
		);
	});

	it('omits an empty query', () => {
		assert.equal(
			appendingAPIPath('https://arcane.test/?', 'auth/me'),
			'https://arcane.test/api/auth/me'
		);
		assert.equal(baseQuery('https://arcane.test/?&&'), undefined);
		assert.equal(baseQuery('https://arcane.test/#?x=1'), undefined);
	});

	it('merges the configured query with request query items', () => {
		const url = withQueryItems(appendingAPIPath('https://arcane.test/?p_token=a%2Bb', 'events'), [
			{ name: 'start', value: '0' },
			{ name: 'search', value: 'web app' }
		]);
		assert.equal(url, 'https://arcane.test/api/events?p_token=a%2Bb&start=0&search=web%20app');
	});

	it('keeps the configured query on websocket URLs', () => {
		assert.equal(
			webSocketURL(
				withQueryItems(appendingAPIPath('https://arcane.test/?p_token=abc', 'ws/logs'), [
					{ name: 'follow', value: 'true' }
				])
			),
			'wss://arcane.test/api/ws/logs?p_token=abc&follow=true'
		);
	});

	it('keeps the query through input normalization', () => {
		assert.equal(
			normalizeServerURLInput(' https://arcane.test/?p_token=abc '),
			'https://arcane.test/?p_token=abc'
		);
		assert.equal(normalizeServerURLInput('arcane.test/?t=1'), 'https://arcane.test/?t=1');
		assert.equal(normalizeServerURLInput('nas.local:3552/?t=1'), 'http://nas.local:3552/?t=1');
	});

	it('ignores the query for origin and identity comparisons', () => {
		assert.equal(
			canonicalServerOrigin('https://arcane.test/?p_token=abc'),
			canonicalServerOrigin('https://arcane.test')
		);
		assert.equal(
			serverCacheIdentity('https://arcane.test/base?p_token=abc'),
			serverCacheIdentity('https://arcane.test/base/')
		);
		assert.equal(isSameOrigin('https://arcane.test/?p_token=abc', 'https://arcane.test/x'), true);
	});

	it('scopes proxied requests to a base URL with a query', () => {
		const support = new ProxyRequestSupport('https://arcane.test/arcane?p_token=abc');
		assert.equal(support.contains('https://arcane.test/arcane/api/auth/me?p_token=abc'), true);
		assert.equal(support.contains('wss://arcane.test/arcane/api/ws?p_token=abc'), true);
		assert.equal(support.contains('https://arcane.test/other?p_token=abc'), false);
	});
});
