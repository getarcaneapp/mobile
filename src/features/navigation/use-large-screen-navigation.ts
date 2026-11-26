import { router, useNavigationContainerRef, useRootNavigationState, type Href } from 'expo-router';

import { canPinToBottomBar, isAppTab, type PinnableTab } from '@/core/app-tab';

import {
	focusedTabGroup,
	planStackDestination,
	planTabSelection,
	sidebarSelection,
	type NavigationPlan,
	type NavigationStateLike,
	type SidebarItem
} from './large-screen-destinations';
import { useVisibleTabs } from './use-visible-tabs';

type NavigationRef = ReturnType<typeof useNavigationContainerRef>;

function rootState(ref: NavigationRef): NavigationStateLike | undefined {
	return ref.isReady() ? (ref.getRootState() as unknown as NavigationStateLike) : undefined;
}

function runPlan(ref: NavigationRef, plan: NavigationPlan) {
	if ('href' in plan) {
		router.navigate(plan.href as Href, { withAnchor: true });
		return;
	}
	for (const action of plan.actions) ref.dispatch(action as never);
}

export function useLargeScreenNavigation() {
	const navigationRef = useNavigationContainerRef();
	const state = useRootNavigationState() as unknown as NavigationStateLike | undefined;
	const { available, visible } = useVisibleTabs();

	const selectTab = (group: PinnableTab | 'more') => {
		runPlan(navigationRef, planTabSelection(rootState(navigationRef), group));
	};

	const openDestination = (item: SidebarItem) => {
		if (isAppTab(item)) {
			if (!available.has(item)) return;
			if (canPinToBottomBar(item) && visible.includes(item)) {
				selectTab(item);
				return;
			}
		}
		runPlan(navigationRef, planStackDestination(rootState(navigationRef), item));
	};

	return {
		available,
		visible,
		focusedGroup: focusedTabGroup(state),
		selection: sidebarSelection(state),
		selectTab,
		openDestination
	};
}
