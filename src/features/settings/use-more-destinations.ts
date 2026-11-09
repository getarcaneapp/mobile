import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { AppTabIDs, type AppTab } from '@/core/app-tab';
import { useClientManager } from '@/stores/client-manager';
import { resolveTabs, useNavTabsStore } from '@/stores/nav-tabs-store';

import { filterMoreGroups, moreGroups } from './more-groups';

export type { MoreDestinationGroup } from './more-groups';

export function useMoreDestinations(search: string) {
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

	const filteredGroups = useMemo(
		() => filterMoreGroups(moreGroups, available, search),
		[search, available]
	);

	const open = (tab: AppTab) => {
		if (!available.has(tab)) return;
		if (visibleTabs.has(tab)) {
			router.navigate(`/(tabs)/(${tab})/${tab}` as never);
		} else {
			router.push(`/(tabs)/(more)/${tab}` as never);
		}
	};

	return { filteredGroups, visibleTabs, open };
}
