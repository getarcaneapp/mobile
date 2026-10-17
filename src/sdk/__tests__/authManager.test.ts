import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { AuthManager } from '../auth/AuthManager';
import { InMemoryTokenStore, type TokenPair } from '../auth/TokenStore';
import { ArcaneTransport } from '../client/ArcaneTransport';
import { RetryPolicy } from '../client/environment';
import { ArcaneUnauthorizedError, isArcaneError } from '../errors/ArcaneError';
import { isoIn, mockFetch, type RecordedRequest } from './helpers';

const BASE = 'https://arcane.test';

function pair(name: string, expiresInSeconds = 3600): TokenPair {
	return {
		accessToken: `access-${name}`,
		refreshToken: `refresh-${name}`,
		expiresAt: isoIn(expiresInSeconds)
	};
}

function refreshReply(name: string) {
	const next = pair(name);
	return {
		status: 200,
		body: {
			success: true,
			data: { token: next.accessToken, refreshToken: next.refreshToken, expiresAt: next.expiresAt }
		}
	};
}

function refreshCalls(requests: RecordedRequest[]): RecordedRequest[] {
	return requests.filter((r) => r.url.endsWith('/api/auth/refresh'));
}

describe('AuthManager refresh', () => {
	it('coalesces concurrent refreshes into one single-use rotation', async () => {
		const store = new InMemoryTokenStore(pair('a'));
		const { fetch, requests } = mockFetch(() => ({ ...refreshReply('b'), delayMs: 20 }));
		const auth = new AuthManager({ baseURL: BASE, tokenStore: store, fetch });

		const results = await Promise.all(Array.from({ length: 5 }, () => auth.refreshTokens()));

		assert.equal(refreshCalls(requests).length, 1);
		assert.deepEqual(refreshCalls(requests)[0]?.body, { refreshToken: 'refresh-a' });
		for (const tokens of results) assert.equal(tokens.refreshToken, 'refresh-b');
		assert.equal((await store.loadTokens())?.refreshToken, 'refresh-b');
		assert.equal(auth.currentAuthorizationHeader(), 'Bearer access-b');
	});

	it('re-reads the token store before refreshing (another process rotated it)', async () => {
		const store = new InMemoryTokenStore(pair('a'));
		const { fetch, requests } = mockFetch(() => refreshReply('c'));
		const auth = new AuthManager({ baseURL: BASE, tokenStore: store, fetch });
		await auth.authenticationHeaders();
		await store.saveTokens(pair('b'));

		await auth.refreshTokens();

		assert.deepEqual(refreshCalls(requests)[0]?.body, { refreshToken: 'refresh-b' });
	});

	it('retries once with the newer token when another process won the rotation race', async () => {
		const store = new InMemoryTokenStore(pair('a'));
		const { fetch, requests } = mockFetch(async (request) => {
			const body = request.body as { refreshToken: string };
			if (body.refreshToken === 'refresh-a') {
				await store.saveTokens(pair('b'));
				return { status: 401, body: { success: false, error: 'invalid refresh token' } };
			}
			return refreshReply('c');
		});
		const auth = new AuthManager({ baseURL: BASE, tokenStore: store, fetch });

		const tokens = await auth.refreshTokens();

		assert.deepEqual(
			refreshCalls(requests).map((r) => (r.body as { refreshToken: string }).refreshToken),
			['refresh-a', 'refresh-b']
		);
		assert.equal(tokens.refreshToken, 'refresh-c');
		assert.equal((await store.loadTokens())?.refreshToken, 'refresh-c');
	});

	it('clears credentials only when the rejected refresh token is still stored', async () => {
		const store = new InMemoryTokenStore(pair('a'));
		const { fetch } = mockFetch(() => ({
			status: 401,
			body: { success: false, error: 'expired' }
		}));
		const auth = new AuthManager({ baseURL: BASE, tokenStore: store, fetch });

		await assert.rejects(auth.refreshTokens(), (error) => error instanceof ArcaneUnauthorizedError);
		assert.equal(await store.loadTokens(), undefined);
	});

	it('keeps credentials on transient refresh failures', async () => {
		const store = new InMemoryTokenStore(pair('a'));
		const { fetch } = mockFetch(() => ({ status: 503, body: { success: false, error: 'down' } }));
		const auth = new AuthManager({ baseURL: BASE, tokenStore: store, fetch });

		await assert.rejects(auth.refreshTokens(), (error) => isArcaneError(error, 'server'));
		assert.equal((await store.loadTokens())?.refreshToken, 'refresh-a');
	});

	it('proactively refreshes a token that is about to expire', async () => {
		const store = new InMemoryTokenStore(pair('a', 10));
		const { fetch, requests } = mockFetch(() => refreshReply('b'));
		const auth = new AuthManager({ baseURL: BASE, tokenStore: store, fetch });

		const headers = await auth.authenticationHeaders();

		assert.equal(refreshCalls(requests).length, 1);
		assert.equal(headers.Authorization, 'Bearer access-b');
	});
});

describe('ArcaneTransport 401 handling', () => {
	it('refreshes once and retries concurrent 401s with the rotated token', async () => {
		const store = new InMemoryTokenStore(pair('a'));
		const { fetch, requests } = mockFetch((request) => {
			if (request.url.endsWith('/api/auth/refresh')) return { ...refreshReply('b'), delayMs: 10 };
			if (request.headers.Authorization === 'Bearer access-b') {
				return { status: 200, body: { success: true, data: { ok: true } } };
			}
			return { status: 401, body: { success: false, error: 'token expired' } };
		});
		const authManager = new AuthManager({ baseURL: BASE, tokenStore: store, fetch });
		const transport = new ArcaneTransport({
			baseURL: BASE,
			authManager,
			fetch,
			streamingFetch: fetch,
			retryPolicy: RetryPolicy.make(1, 0, 0)
		});

		const results = await Promise.all([
			transport.request<{ ok: boolean }>('auth/me'),
			transport.request<{ ok: boolean }>('environments/0/containers'),
			transport.request<{ ok: boolean }>('environments/0/images')
		]);

		for (const result of results) assert.deepEqual(result, { ok: true });
		assert.equal(refreshCalls(requests).length, 1);
		assert.equal(requests.filter((r) => !r.url.endsWith('/api/auth/refresh')).length, 6);
	});

	it('clears credentials when a 401 survives the refresh', async () => {
		const store = new InMemoryTokenStore(pair('a'));
		const { fetch, requests } = mockFetch((request) =>
			request.url.endsWith('/api/auth/refresh')
				? refreshReply('b')
				: { status: 401, body: { success: false, error: 'no' } }
		);
		const authManager = new AuthManager({ baseURL: BASE, tokenStore: store, fetch });
		const transport = new ArcaneTransport({
			baseURL: BASE,
			authManager,
			fetch,
			streamingFetch: fetch
		});

		await assert.rejects(transport.request('auth/me'), (error) =>
			isArcaneError(error, 'unauthorized')
		);
		assert.equal(refreshCalls(requests).length, 1);
		assert.equal(await store.loadTokens(), undefined);
	});

	it('treats a non-Arcane 401 as an intermediary rejection without clearing tokens', async () => {
		const store = new InMemoryTokenStore(pair('a'));
		const { fetch } = mockFetch(() => ({
			status: 401,
			body: 'Unauthorized',
			headers: { 'Content-Type': 'text/plain' }
		}));
		const authManager = new AuthManager({ baseURL: BASE, tokenStore: store, fetch });
		const transport = new ArcaneTransport({
			baseURL: BASE,
			authManager,
			fetch,
			streamingFetch: fetch
		});

		await assert.rejects(transport.request('auth/me'), (error) =>
			isArcaneError(error, 'authenticationRejected')
		);
		assert.equal((await store.loadTokens())?.refreshToken, 'refresh-a');
	});
});
