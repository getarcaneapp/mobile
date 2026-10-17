import { create } from 'zustand';

import {
	AppTabIDs,
	canPinToBottomBar,
	isAppTab,
	mainDefaults,
	type AppTab,
	type PinnableTab
} from '@/core/app-tab';
import { Keys, storage } from '@/core/storage';

const slotCount = 4;

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

/**
 * Drops tabs the authenticated session cannot reach, then fills empty slots
 * with other available primary destinations. Port of `NavTabsStore.resolveTabs`.
 */
export function resolveTabs(
	pinned: readonly AppTab[],
	availableTabs: ReadonlySet<AppTab>
): PinnableTab[] {
	const visible: PinnableTab[] = pinned.filter(
		(tab): tab is PinnableTab => canPinToBottomBar(tab) && availableTabs.has(tab)
	);
	for (const fallback of mainDefaults) {
		if (visible.length === slotCount) break;
		if (availableTabs.has(fallback) && !visible.includes(fallback)) visible.push(fallback);
	}
	for (const fallback of AppTabIDs) {
		if (visible.length === slotCount) break;
		if (canPinToBottomBar(fallback) && availableTabs.has(fallback) && !visible.includes(fallback)) {
			visible.push(fallback);
		}
	}
	return visible.slice(0, slotCount);
}

type NavTabsState = {
	/** The 4 swappable tabs (More is always pinned separately). */
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
