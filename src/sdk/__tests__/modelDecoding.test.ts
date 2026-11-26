import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { parseArcaneJSON } from '../http/json';
import { ActivityStatus } from '../models/activity/Activity';
import { ContainerListResponse } from '../models/container/ContainerDetails';
import { ProjectURL } from '../models/project/Project';

function row(id: string, extra: Record<string, unknown> = {}) {
	return {
		id,
		names: [`/${id}`],
		image: 'nginx',
		imageId: 'sha256:1',
		command: 'nginx',
		created: 1,
		ports: [],
		state: 'running',
		status: 'Up',
		hostConfig: {},
		networkSettings: {},
		mounts: [],
		...extra
	};
}

describe('ContainerListResponse.decode (lossy rows)', () => {
	it('drops undecodable rows, tolerates bad samples, and defaults missing keys', () => {
		const text = JSON.stringify({
			success: true,
			data: [
				row('a', { labels: null }),
				{ id: 'broken' },
				row('b', { resourceSample: { cpuPercent: 'high' } })
			],
			counts: { runningContainers: 1, stoppedContainers: 0, totalContainers: 1 },
			pagination: { totalPages: 1, totalItems: 3, currentPage: 1, itemsPerPage: 20 }
		});
		const response = ContainerListResponse.decode(parseArcaneJSON(text));
		assert.deepEqual(
			response.data.map((c) => c.id),
			['a', 'b']
		);
		assert.deepEqual(response.data[0]?.labels, {});
		assert.deepEqual(response.data[0]?.networkSettings, { networks: {} });
		assert.equal(response.data[1]?.resourceSample, undefined);
		assert.equal(response.resourceSortSupported, false);
	});
});

describe('open enums with unknown(String)', () => {
	it('passes unknown server values through', () => {
		const status = ActivityStatus.decode('paused-by-admin');
		assert.equal(status, 'paused-by-admin');
		assert.equal(ActivityStatus.isKnown(status), false);
		assert.equal(ActivityStatus.isKnown(ActivityStatus.decode('running')), true);
	});
});

describe('ProjectURL.decode', () => {
	it('accepts plain strings and labeled objects', () => {
		assert.deepEqual(ProjectURL.decode('https://a.example'), { url: 'https://a.example' });
		assert.deepEqual(ProjectURL.decode({ url: 'https://b.example', label: 'Docs' }), {
			url: 'https://b.example',
			label: 'Docs'
		});
		assert.deepEqual(ProjectURL.decode({ url: 'https://c.example' }), {
			url: 'https://c.example',
			label: undefined
		});
	});
});
