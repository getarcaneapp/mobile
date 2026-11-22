import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import type { NetworkTopology } from '../../../sdk/models/network/Topology';
import { makeTopologyLayout } from '../topology-graph';

const topology: NetworkTopology = {
	nodes: [
		{ id: 'n1', name: 'alpha', type: 'network', metadata: {} },
		{ id: 'n2', name: 'beta', type: 'network', metadata: {} },
		{ id: 'c1', name: 'web', type: 'container', metadata: {} },
		{ id: 'c2', name: 'db', type: 'container', metadata: {} },
		{ id: 'c3', name: 'lonely', type: 'container', metadata: {} }
	],
	edges: [
		{ id: 'e1', source: 'n1', target: 'c1', ipv4Address: '10.0.0.2' },
		{ id: 'e2', source: 'n2', target: 'c1', ipv4Address: '10.1.0.2' },
		{ id: 'e3', source: 'n2', target: 'c2' }
	]
};

describe('topology layout', () => {
	const layout = makeTopologyLayout(topology);
	const kinds = layout.placements.map((p) => `${p.kind}:${p.node.name}`);

	it('stacks containers under their networks and links shared ones', () => {
		assert.deepEqual(kinds, [
			'network:alpha',
			'container:web',
			'network:beta',
			'container:db',
			'link:web',
			'container:lonely'
		]);
		assert.equal(layout.rails.length, 2);
		assert.deepEqual(
			layout.placements.find((p) => p.kind === 'link')?.connections.map((c) => c.ipv4Address),
			['10.1.0.2']
		);
	});

	it('keeps every card inside the content width without overlap', () => {
		let bottom = 0;
		for (const placement of layout.placements) {
			const { x, y, width, height } = placement.frame;
			assert.ok(x >= 0 && x + width <= layout.contentSize.width);
			assert.ok(y >= bottom);
			bottom = y + height;
		}
		assert.ok(bottom <= layout.contentSize.height);
	});
});
