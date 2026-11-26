import { isAppTab, type AppTab } from '@/core/app-tab';
import {
	filterMoreGroups,
	moreGroups,
	moreTiles,
	resourcesTitle,
	type MoreDestinationGroup
} from '@/features/settings/more-groups';

export const sidebarAppItems = ['app-settings', 'preview-features'] as const;

export type SidebarAppItem = (typeof sidebarAppItems)[number];

export type SidebarItem = AppTab | SidebarAppItem | 'profile';

export function isSidebarItem(value: string): value is SidebarItem {
	return (
		isAppTab(value) || value === 'profile' || (sidebarAppItems as readonly string[]).includes(value)
	);
}

export function sidebarGroups(available: ReadonlySet<AppTab>): MoreDestinationGroup[] {
	return filterMoreGroups(
		[{ title: resourcesTitle, tabs: moreTiles }, ...moreGroups],
		available,
		''
	);
}

export type NavigationRouteLike = { key?: string; name: string; state?: NavigationStateLike };

export type NavigationStateLike = { key?: string; index?: number; routes: NavigationRouteLike[] };

export type NavigationActionLike = {
	type: 'JUMP_TO' | 'POP_TO' | 'POP_TO_TOP' | 'PUSH';
	payload?: { name: string; merge?: boolean };
	source?: string;
	target: string;
};

export type NavigationPlan = { actions: NavigationActionLike[] } | { href: string };

const moreGroup = '(more)';

function tabsState(root: NavigationStateLike | undefined): NavigationStateLike | undefined {
	return root?.routes.find((route) => route.name === '(tabs)')?.state;
}

function focusedIndex(state: NavigationStateLike): number {
	return state.index ?? state.routes.length - 1;
}

function groupID(name: string | undefined): string | undefined {
	return name?.match(/^\((.+)\)$/)?.[1];
}

export function focusedTabGroup(root: NavigationStateLike | undefined): string | undefined {
	const tabs = tabsState(root);
	return tabs ? groupID(tabs.routes[focusedIndex(tabs)]?.name) : undefined;
}

export function sidebarSelection(root: NavigationStateLike | undefined): SidebarItem | undefined {
	const tabs = tabsState(root);
	if (!tabs) return undefined;
	const route = tabs.routes[focusedIndex(tabs)];
	const group = groupID(route?.name);
	if (group === undefined) return undefined;
	if (route?.name !== moreGroup) return isAppTab(group) ? group : undefined;
	const stack = route.state;
	if (!stack) return undefined;
	const depth = focusedIndex(stack);
	for (let index = 1; index <= depth; index += 1) {
		const name = stack.routes[index]?.name;
		if (name !== undefined && isSidebarItem(name)) return name;
	}
	return undefined;
}

export function tabRootHref(group: string): string {
	return `/(tabs)/(${group})/${group}`;
}

export function planTabSelection(
	root: NavigationStateLike | undefined,
	group: string
): NavigationPlan {
	const tabs = tabsState(root);
	const name = `(${group})`;
	const route = tabs?.routes.find((candidate) => candidate.name === name);
	if (!tabs?.key || !route) return { href: tabRootHref(group) };
	if (tabs.routes[focusedIndex(tabs)]?.name !== name) {
		return { actions: [{ type: 'JUMP_TO', payload: { name }, target: tabs.key }] };
	}
	const stack = route.state;
	if (stack?.key && focusedIndex(stack) > 0) {
		return { actions: [{ type: 'POP_TO_TOP', target: stack.key }] };
	}
	return { actions: [] };
}

export function planStackDestination(
	root: NavigationStateLike | undefined,
	screen: string
): NavigationPlan {
	const href = `/(tabs)/${moreGroup}/${screen}`;
	const tabs = tabsState(root);
	const route = tabs?.routes.find((candidate) => candidate.name === moreGroup);
	const stack = route?.state;
	if (!tabs?.key || !stack?.key) return { href };
	const actions: NavigationActionLike[] = [];
	const first = stack.routes[1];
	if (first?.key === undefined) {
		actions.push({ type: 'PUSH', payload: { name: screen }, target: stack.key });
	} else if (first.name !== screen || focusedIndex(stack) > 1) {
		actions.push({
			type: 'POP_TO',
			payload: { name: screen, merge: true },
			source: first.key,
			target: stack.key
		});
	}
	if (tabs.routes[focusedIndex(tabs)]?.name !== moreGroup) {
		actions.push({ type: 'JUMP_TO', payload: { name: moreGroup }, target: tabs.key });
	}
	return { actions };
}
