import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { AppTabIDs, type AppTab } from '@/core/app-tab';
import { useClientManager } from '@/stores/client-manager';
import { resolveTabs, useNavTabsStore } from '@/stores/nav-tabs-store';

import {
	filterMoreGroups,
	moreGroups,
	moreTiles,
	resourcesTitle,
	serverSettingsGroups,
	workspaceGroups
} from './more-groups';

export type { MoreDestinationGroup } from './more-groups';

function useDestinationAccess() {
	const router = useRouter();
	const canAccess = useClientManager((s) => s.canAccess);
	const accessGeneration = useClientManager((s) => s.accessGeneration);
	const pinned = useNavTabsStore((s) => s.pinnedTabs);

	const available = useMemo(() => {
		void accessGeneration;
		return new Set<AppTab>(AppTabIDs.filter(canAccess));
	}, [canAccess, accessGeneration]);
	const visibleTabs = useMemo(
		() => new Set<AppTab>(resolveTabs(pinned, available)),
		[pinned, available]
	);

	const open = (tab: AppTab) => {
		if (!available.has(tab)) return;
		if (visibleTabs.has(tab)) {
			router.navigate(`/(tabs)/(${tab})/${tab}` as never);
		} else {
			router.push(`/(tabs)/(more)/${tab}` as never);
		}
	};

	return { available, visibleTabs, open };
}

export function useMoreDestinations(search: string) {
	const { available, visibleTabs, open } = useDestinationAccess();
	const isSearching = search.trim() !== '';
	const listed = useMemo(
		() =>
			isSearching ? available : new Set([...available].filter((tab) => !visibleTabs.has(tab))),
		[isSearching, available, visibleTabs]
	);
	const tileGroups = useMemo(
		() =>
			isSearching
				? []
				: filterMoreGroups(
						[{ title: resourcesTitle, tabs: moreTiles }, ...workspaceGroups],
						listed,
						''
					),
		[isSearching, listed]
	);
	const searchResults = useMemo(
		() =>
			isSearching
				? filterMoreGroups(
						[{ title: resourcesTitle, tabs: moreTiles }, ...moreGroups],
						listed,
						search
					)
				: [],
		[isSearching, search, listed]
	);
	const hasServerSettings = useMemo(
		() => serverSettingsGroups.some((group) => group.tabs.some((tab) => available.has(tab))),
		[available]
	);

	return { isSearching, tileGroups, searchResults, hasServerSettings, visibleTabs, open };
}

export function useServerSettingsDestinations() {
	const { available, visibleTabs, open } = useDestinationAccess();
	const groups = useMemo(() => filterMoreGroups(serverSettingsGroups, available, ''), [available]);
	return { groups, visibleTabs, open };
}
