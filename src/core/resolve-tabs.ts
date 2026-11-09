import {
	AppTabIDs,
	canPinToBottomBar,
	mainDefaults,
	type AppTab,
	type PinnableTab
} from '@/core/app-tab';

export const slotCount = 4;

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
