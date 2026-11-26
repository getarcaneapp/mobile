import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	moreGroups,
	moreTiles,
	serverSettingsGroups,
	workspaceGroups
} from '../../features/settings/more-groups';

describe('More destinations', () => {
	it('lists every destination once across pages and server settings', () => {
		const all = [
			...moreTiles,
			...workspaceGroups.flatMap((group) => group.tabs),
			...serverSettingsGroups.flatMap((group) => group.tabs)
		];
		assert.equal(new Set(all).size, all.length);
	});

	it('keeps sidebar groups in sync with both More screens', () => {
		assert.deepEqual(moreGroups, [...workspaceGroups, ...serverSettingsGroups]);
	});

	it('keeps server settings out of the page tiles', () => {
		const settings = new Set(serverSettingsGroups.flatMap((group) => group.tabs));
		assert.ok(
			![...moreTiles, ...workspaceGroups.flatMap((g) => g.tabs)].some((tab) => settings.has(tab))
		);
	});
});
