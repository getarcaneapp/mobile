import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { retryAfterMs } from '../client/ArcaneTransport';
import { arcaneErrorFrom, ArcaneForbiddenError, ArcaneNotFoundError } from '../errors/ArcaneError';
import { ContainerStatsPayload } from '../models/container/ContainerStats';
import { DashboardStreamEvent } from '../models/dashboard/DashboardStream';
import { decodeLogFrame } from '../streaming/Streams';
import { terminalQuery, terminalResizeFrame } from '../streaming/TerminalSession';

describe('server alignment', () => {
	it('keeps the server detail on forbidden and not found errors', () => {
		const forbidden = arcaneErrorFrom(403, JSON.stringify({ detail: 'Missing volumes:read' }));
		assert.ok(forbidden instanceof ArcaneForbiddenError);
		assert.equal(forbidden.detail, 'Missing volumes:read');
		const notFound = arcaneErrorFrom(404, JSON.stringify({ error: 'Volume not found' }));
		assert.ok(notFound instanceof ArcaneNotFoundError);
		assert.equal(notFound.detail, 'Volume not found');
		assert.equal((arcaneErrorFrom(404, '') as ArcaneNotFoundError).detail, undefined);
	});

	it('decodes batched log frames', () => {
		const lines = decodeLogFrame({
			kind: 'string',
			value: JSON.stringify([
				{ seq: 1, message: 'a' },
				{ seq: 2, message: 'b', level: 'info' }
			])
		});
		assert.deepEqual(
			lines.map((line) => line.text),
			['a', 'b']
		);
		assert.deepEqual(
			decodeLogFrame({ kind: 'string', value: JSON.stringify({ message: 'c' }) }).map(
				(line) => line.text
			),
			['c']
		);
		assert.deepEqual(decodeLogFrame({ kind: 'string', value: 'plain' }), [{ text: 'plain' }]);
	});

	it('treats container stats error frames as errors', () => {
		assert.throws(() =>
			ContainerStatsPayload.decode({ error: 'stream failed', timestamp: '2026-01-01T00:00:00Z' })
		);
		assert.ok(ContainerStatsPayload.decode({ read: '2026-01-01T00:00:00Z' }));
	});

	it('unwraps dashboard events from the multiplexed stream', () => {
		const event = DashboardStreamEvent.decode({
			channel: 'dashboard',
			timestamp: '2026-01-01T00:00:00Z',
			dashboard: { type: 'pending', environmentId: 'e1', timestamp: '2026-01-01T00:00:00Z' }
		});
		assert.equal(event.type, 'pending');
		assert.equal(event.environmentID, 'e1');
	});

	it('sends terminal dimensions', () => {
		assert.deepEqual(terminalQuery('/bin/sh', { cols: 80.7, rows: 24 }), [
			{ name: 'shell', value: '/bin/sh' },
			{ name: 'cols', value: '80' },
			{ name: 'rows', value: '24' }
		]);
		assert.equal(
			terminalResizeFrame({ cols: 120, rows: 0 }),
			JSON.stringify({ type: 'resize', cols: 120, rows: 1 })
		);
	});

	it('parses Retry-After headers', () => {
		assert.equal(retryAfterMs('3'), 3000);
		assert.equal(retryAfterMs(null), undefined);
		assert.equal(retryAfterMs('nonsense'), undefined);
		const now = Date.parse('2026-01-01T00:00:00Z');
		assert.equal(retryAfterMs('Thu, 01 Jan 2026 00:00:05 GMT', now), 5000);
	});
});
