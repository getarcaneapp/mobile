import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { quickActionItems, quickActionTab } from '../quick-action-items';

describe('quickActionItems', () => {
	it('lists accessible tabs with symbols only on iOS', () => {
		const items = quickActionItems((tab) => tab !== 'updates', true);
		assert.deepEqual(
			items.map((item) => item.id),
			['dashboard', 'containers', 'projects']
		);
		assert.equal(items[1]?.icon, 'symbol:cube.box.fill');
		assert.equal(quickActionItems(() => true, false)[0]?.icon, null);
	});
});

describe('quickActionTab', () => {
	it('reads the tab param and ignores unknown values', () => {
		assert.equal(quickActionTab({ params: { tab: 'projects' } }), 'projects');
		assert.equal(quickActionTab({ params: { tab: 'swarm' } }), undefined);
		assert.equal(quickActionTab(undefined), undefined);
	});
});
