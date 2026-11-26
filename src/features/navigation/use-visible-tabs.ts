import { useMemo } from 'react';

import { AppTabIDs, type AppTab } from '@/core/app-tab';
import { useClientManager } from '@/stores/client-manager';
import { resolveTabs, useNavTabsStore } from '@/stores/nav-tabs-store';

export function useVisibleTabs() {
	const pinned = useNavTabsStore((s) => s.pinnedTabs);
	const canAccess = useClientManager((s) => s.canAccess);
	const accessGeneration = useClientManager((s) => s.accessGeneration);

	const available = useMemo(() => {
		void accessGeneration;
		return new Set<AppTab>(AppTabIDs.filter(canAccess));
	}, [canAccess, accessGeneration]);
	const visible = useMemo(() => resolveTabs(pinned, available), [pinned, available]);

	return { available, visible };
}
