/** Shared state for `EditTabsView` (SettingsView.swift). */
import { useMemo, useState } from 'react';

import { AppTabIDs, canPinToBottomBar, type AppTab } from '@/core/app-tab';
import { useClientManager } from '@/stores/client-manager';
import { resolveTabs, useNavTabsStore } from '@/stores/nav-tabs-store';

/** Swift `Array.move(fromOffsets:toOffset:)`. */
export function moveItems<T>(
	items: readonly T[],
	sourceIndices: readonly number[],
	destination: number
): T[] {
	const moving = sourceIndices.map((i) => items[i]).filter((item): item is T => item !== undefined);
	const remaining = items.filter((_, i) => !sourceIndices.includes(i));
	remaining.splice(destination - sourceIndices.filter((i) => i < destination).length, 0, ...moving);
	return remaining;
}

export function useEditTabs() {
	const canAccess = useClientManager((s) => s.canAccess);
	const accessGeneration = useClientManager((s) => s.accessGeneration);
	// `accessGeneration` bumps whenever `canAccess`'s answers change.
	const availableTabs = useMemo(() => {
		void accessGeneration;
		return new Set<AppTab>(AppTabIDs.filter(canAccess));
	}, [canAccess, accessGeneration]);
	const [selection, setSelection] = useState<AppTab[]>(() =>
		resolveTabs(useNavTabsStore.getState().pinnedTabs, availableTabs)
	);

	const candidates = AppTabIDs.filter((tab) => canPinToBottomBar(tab) && availableTabs.has(tab));

	const save = (next: AppTab[]) => {
		setSelection(next);
		if (next.length !== 4) return;
		useNavTabsStore.getState().setPinnedTabs(next);
	};

	return {
		selection,
		replacements: (current: AppTab) =>
			candidates.filter((tab) => tab === current || !selection.includes(tab)),
		replaceTab: (index: number, replacement: AppTab) => {
			if (index < 0 || index >= selection.length) return;
			save(selection.map((tab, i) => (i === index ? replacement : tab)));
		},
		moveTabs: (sourceIndices: number[], destination: number) =>
			save(moveItems(selection, sourceIndices, destination)),
		resetToDefaults: () => {
			useNavTabsStore.getState().resetToDefaults();
			setSelection(resolveTabs(useNavTabsStore.getState().pinnedTabs, availableTabs));
		}
	};
}

export const EditTabsCopy = {
	footer: 'Choose four unique destinations. More always stays in the fifth position.'
} as const;
