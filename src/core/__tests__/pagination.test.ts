import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	PaginationLoader,
	ProgressivePaginationState,
	progressiveFanOut
} from '../networking/pagination-loader';
import {
	RemoteDataLimitError,
	boundedText,
	utf8ByteLength
} from '../networking/remote-data-limits';
import { reusingUnchanged } from '@/stores/environment-item-identity';
import { environmentSources } from '../networking/environment-sources';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';

const items = (start: number, count: number) =>
	Array.from({ length: count }, (_, i) => ({ id: String(start + i) }));

function server(total: number) {
	const calls: number[] = [];
	return {
		calls,
		fetch: async (start: number, limit: number) => {
			calls.push(start);
			const count = Math.max(0, Math.min(limit, total - start));
			return {
				items: items(start, count),
				pagination: {
					totalItems: total,
					totalPages: Math.ceil(total / limit),
					currentPage: start / limit + 1,
					itemsPerPage: limit
				}
			};
		}
	};
}

describe('PaginationLoader.collect', () => {
	it('collects every page in order, fetching the rest concurrently', async () => {
		const s = server(120);
		const result = await PaginationLoader.collect(s.fetch, { pageSize: 50 });
		assert.equal(result.length, 120);
		assert.deepEqual(
			result.map((i) => i.id),
			items(0, 120).map((i) => i.id)
		);
		assert.deepEqual(s.calls, [0, 50, 100]);
	});
	it('throws when the total exceeds the limit', async () => {
		await assert.rejects(
			PaginationLoader.collect(server(30).fetch, { pageSize: 10, maximumItems: 20 }),
			RemoteDataLimitError
		);
	});
	it('walks sequentially when the total is unknown', async () => {
		const fetch = async (start: number, limit: number) => ({
			items: items(start, start >= 20 ? 3 : limit),
			pagination: { totalItems: -1, totalPages: -1, currentPage: 0, itemsPerPage: 0 }
		});
		assert.equal((await PaginationLoader.collect(fetch, { pageSize: 10 })).length, 23);
	});
	it('dedupes merges', () => {
		assert.deepEqual(PaginationLoader.merge([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }], false), [
			{ id: 'a' },
			{ id: 'b' }
		]);
		assert.deepEqual(PaginationLoader.merge([{ id: 'a' }], [{ id: 'b' }], true), [{ id: 'b' }]);
	});
});

describe('ProgressivePaginationState', () => {
	it('tracks the next offset and whether more remain', () => {
		const pagination = { totalItems: 75, totalPages: 2, currentPage: 1, itemsPerPage: 50 };
		const first = ProgressivePaginationState.receive(ProgressivePaginationState.initial, {
			pagination,
			itemCount: 50,
			requestedStart: 0,
			requestedLimit: 50,
			generation: 0
		});
		assert.deepEqual(first, { generation: 0, nextStart: 50, hasMore: true, totalItems: 75 });
		const second = ProgressivePaginationState.receive(first!, {
			pagination: { ...pagination, currentPage: 2 },
			itemCount: 25,
			requestedStart: 50,
			requestedLimit: 50,
			generation: 0
		});
		assert.equal(second?.hasMore, false);
	});
	it('ignores stale generations', () => {
		const reset = ProgressivePaginationState.reset(ProgressivePaginationState.initial);
		assert.equal(
			ProgressivePaginationState.receive(reset, {
				pagination: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 1 },
				itemCount: 1,
				requestedStart: 0,
				requestedLimit: 1,
				generation: 0
			}),
			undefined
		);
	});
});

describe('progressiveFanOut', () => {
	it('delivers every output, coalescing fast arrivals', async () => {
		const batches: number[][] = [];
		await progressiveFanOut(
			[1, 2, 3, 4],
			(n) => new Promise<number>((resolve) => setTimeout(() => resolve(n), n === 4 ? 250 : 5)),
			(batch) => batches.push(batch),
			100
		);
		assert.deepEqual(
			batches.flat().sort((a, b) => a - b),
			[1, 2, 3, 4]
		);
		assert.ok(batches.length <= 3);
	});
});

describe('environment item identity', () => {
	const item = (id: string, name: string) => ({
		id,
		environmentID: '0',
		value: { id, name }
	});

	it('returns the previous array when every item is unchanged', () => {
		const previous = [item('a', 'one'), item('b', 'two')];
		assert.equal(reusingUnchanged(previous, [item('a', 'one'), item('b', 'two')]), previous);
	});

	it('keeps unchanged items and replaces changed ones', () => {
		const previous = [item('a', 'one'), item('b', 'two')];
		const next = reusingUnchanged(previous, [
			item('a', 'one'),
			item('b', 'changed'),
			item('c', 'new')
		]);
		assert.equal(next[0], previous[0]);
		assert.notEqual(next[1], previous[1]);
		assert.equal(next[1]?.value.name, 'changed');
		assert.equal(next.length, 3);
	});

	it('detects reordering', () => {
		const previous = [item('a', 'one'), item('b', 'two')];
		const next = reusingUnchanged(previous, [item('b', 'two'), item('a', 'one')]);
		assert.notEqual(next, previous);
		assert.equal(next[0], previous[1]);
	});
});

describe('boundedText fast paths', () => {
	const encoder = new TextEncoder();
	const reference = (text: string, maximumBytes: number) => {
		if (maximumBytes <= 0) return '';
		if (encoder.encode(text).byteLength <= maximumBytes) return text;
		const marker = '\n… output truncated …';
		const contentLimit = Math.max(0, maximumBytes - encoder.encode(marker).byteLength);
		let used = 0;
		let result = '';
		for (const character of text) {
			const bytes = encoder.encode(character).byteLength;
			if (used + bytes > contentLimit) break;
			result += character;
			used += bytes;
		}
		return result + marker;
	};

	it('matches the TextEncoder implementation', () => {
		const texts = [
			'',
			'plain ascii line',
			'héllo wörld',
			'日本語のログ行',
			'emoji 🚀🔥 and text',
			'lone \uD800 surrogate',
			'x'.repeat(500),
			'é'.repeat(300) + '🚀'.repeat(50)
		];
		for (const text of texts) {
			assert.equal(utf8ByteLength(text), encoder.encode(text).byteLength);
			for (const limit of [0, 1, 10, 30, 64, 256, 2048])
				assert.equal(boundedText(text, limit), reference(text, limit));
		}
	});
});

describe('environmentSources', () => {
	const fakeClient = (generation: 'v3' | 'legacy', limit: string) =>
		({
			transport: {},
			apiGeneration: async () => generation,
			settings: {
				getPublicSettings: async () => [{ key: 'allEnvironmentsLimit', value: limit }]
			}
		}) as unknown as ArcaneClient;
	const environments = ['0', 'a', 'b', 'c', 'd'].map((id) => ({ id }));

	it('groups environments into chunks bounded by the server limit on v3', async () => {
		const sources = await environmentSources(fakeClient('v3', '2'), environments);
		assert.deepEqual(
			sources.map((source) => source.key),
			['0,a', 'b,c', 'd']
		);
	});

	it('keeps one source per environment on legacy servers', async () => {
		const sources = await environmentSources(fakeClient('legacy', '2'), environments);
		assert.deepEqual(
			sources.map((source) => source.key),
			['0', 'a', 'b', 'c', 'd']
		);
	});
});
