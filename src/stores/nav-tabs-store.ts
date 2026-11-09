import { create } from 'zustand';

import {
	canPinToBottomBar,
	isAppTab,
	mainDefaults,
	type AppTab,
	type PinnableTab
} from '@/core/app-tab';
import { resolveTabs, slotCount } from '@/core/resolve-tabs';
import { Keys, storage } from '@/core/storage';

export { resolveTabs };

function isValidConfiguration(tabs: AppTab[]): tabs is PinnableTab[] {
	return (
		tabs.length === slotCount && new Set(tabs).size === slotCount && tabs.every(canPinToBottomBar)
	);
}

function loadPinnedTabs(): PinnableTab[] {
	const ids = storage.json<unknown>(Keys.navBarTabs);
	if (!Array.isArray(ids) || ids.length !== slotCount) return mainDefaults;
	const resolved = ids.filter((id): id is AppTab => typeof id === 'string' && isAppTab(id));
	return isValidConfiguration(resolved) ? resolved : mainDefaults;
}

type NavTabsState = {
	pinnedTabs: PinnableTab[];
	swap: (pinned: PinnableTab, replacement: PinnableTab) => void;
	setPinnedTabs: (tabs: AppTab[]) => boolean;
	resetToDefaults: () => void;
};

export const useNavTabsStore = create<NavTabsState>((set, get) => ({
	pinnedTabs: loadPinnedTabs(),
	swap: (pinned, replacement) => {
		const current = [...get().pinnedTabs];
		const index = current.indexOf(pinned);
		if (index < 0) return;
		current[index] = replacement;
		storage.setJSON(Keys.navBarTabs, current);
		set({ pinnedTabs: loadPinnedTabs() });
	},
	setPinnedTabs: (tabs) => {
		if (!isValidConfiguration(tabs)) return false;
		storage.setJSON(Keys.navBarTabs, tabs);
		set({ pinnedTabs: tabs });
		return true;
	},
	resetToDefaults: () => {
		storage.remove(Keys.navBarTabs);
		set({ pinnedTabs: mainDefaults });
	}
}));
