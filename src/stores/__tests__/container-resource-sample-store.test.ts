import { describe, expect, it } from 'vite-plus/test';

import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { ContainerResourceSampleStore } from '@/stores/container-resource-sample-store';

const sample = { cpuPercent: 1, memoryUsageBytes: 2, memoryLimitBytes: 3, sampleTime: 't' };

function fakeClient(transport: object, list: () => Promise<unknown>) {
	return { transport, containers: { list } } as unknown as ArcaneClient;
}

const response = (id: string) => ({
	resourceSortSupported: true,
	data: [{ id, resourceSample: sample }]
});

describe('ContainerResourceSampleStore', () => {
	it('resets samples when the transport changes', async () => {
		const store = new ContainerResourceSampleStore();
		await store.refresh(
			fakeClient({}, async () => response('a')),
			['env']
		);
		expect(store.sample('a', 'env')).toBeDefined();
		await store.refresh(
			fakeClient({}, async () => response('b')),
			['env']
		);
		expect(store.sample('a', 'env')).toBeUndefined();
		expect(store.sample('b', 'env')).toBeDefined();
	});

	it('drops results from an old transport', async () => {
		const store = new ContainerResourceSampleStore();
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const stale = store.refresh(
			fakeClient({}, async () => {
				await gate;
				return response('old');
			}),
			['env']
		);
		await store.refresh(
			fakeClient({}, async () => response('new')),
			['env']
		);
		release();
		await stale;
		expect(store.sample('old', 'env')).toBeUndefined();
		expect(store.sample('new', 'env')).toBeDefined();
	});
});
