import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { filterMoreGroups, moreGroups } from '../../features/settings/more-groups';
import { ServerCapabilities } from '../../sdk/client/ServerCapabilities';
import type { User } from '../../sdk/models/user/User';
import { advancedTabs, initialAdvancedFeatures } from '../advanced-tabs';
import { AppTabIDs, type AppTab } from '../app-tab';
import { canAccessTab, type AccessContext } from '../auth/access';
import { resolveTabs } from '../resolve-tabs';

const context = (advancedFeatures: boolean): AccessContext => ({
	currentUser: { id: 'u', username: 'u', roles: ['admin'] } as unknown as User,
	serverCapabilities: ServerCapabilities.make('legacyRoles'),
	permissionsManifest: undefined,
	activeEnvironmentID: '0',
	allEnvironmentsPreview: false,
	advancedFeatures
});

const available = (advancedFeatures: boolean) =>
	new Set<AppTab>(AppTabIDs.filter((tab) => canAccessTab(tab, context(advancedFeatures))));

describe('advanced features', () => {
	it('hides advanced tabs only when off', () => {
		for (const tab of advancedTabs) assert.equal(canAccessTab(tab, context(false)), false);
		assert.equal(canAccessTab('containers', context(false)), true);
		assert.equal(canAccessTab('customize', context(true)), true);
	});

	it('defaults on for existing installs', () => {
		assert.equal(initialAdvancedFeatures(undefined, true), true);
		assert.equal(initialAdvancedFeatures(undefined, false), false);
		assert.equal(initialAdvancedFeatures(false, true), false);
	});

	it('drops pinned advanced tabs and refills', () => {
		const tabs = available(false);
		const visible = resolveTabs(['customize', 'containers', 'images', 'projects'], tabs);
		assert.equal(visible.length, 4);
		assert.ok(!visible.includes('customize' as never));
		assert.ok(visible.every((tab) => tabs.has(tab)));
	});

	it('drops the empty Setup group', () => {
		const titles = filterMoreGroups(moreGroups, available(false), '').map((g) => g.title);
		assert.ok(!titles.includes('Setup'));
		assert.ok(filterMoreGroups(moreGroups, available(true), '').some((g) => g.title === 'Setup'));
	});
});
