import { router, type Href } from 'expo-router';

import { AppTabIDs, type AppTab } from '@/core/app-tab';
import { enqueueShortcutAction } from '@/core/shortcuts/shortcut-actions';
import { itemRoute, parseShortcutLink, type ShortcutLink } from '@/core/shortcuts/shortcut-links';
import { PendingLaunchRoute, parseWidgetLink, tabHref } from '@/core/widgets/widget-links';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { resolveTabs, useNavTabsStore } from '@/stores/nav-tabs-store';

const authCallback = /^arcane-mobile:\/\/\/?(?:oidc|passkey)-callback(?:[/?#]|$)/i;
const pendingItemDelayMs = 400;

let pendingItemRoute: string | undefined;

useClientManager.subscribe((state, previous) => {
	if (state.authState === previous.authState) return;
	if (state.authState === 'login' || state.authState === 'setup') pendingItemRoute = undefined;
	if (state.authState !== 'authenticated' || !pendingItemRoute) return;
	const route = pendingItemRoute;
	pendingItemRoute = undefined;
	setTimeout(() => router.push(route as Href), pendingItemDelayMs);
});

function visibleTabs(): { available: Set<AppTab>; visible: AppTab[] } {
	const manager = useClientManager.getState();
	const available = new Set<AppTab>(AppTabIDs.filter(manager.canAccess));
	return { available, visible: resolveTabs(useNavTabsStore.getState().pinnedTabs, available) };
}

function widgetLinkPath(path: string, initial: boolean): string | null | undefined {
	const link = parseWidgetLink(path);
	if (!link) return undefined;
	const manager = useClientManager.getState();
	if (manager.authState === 'login' || manager.authState === 'setup') return initial ? '/' : null;
	if (link.environmentID && link.environmentID !== manager.activeEnvironmentID) {
		const name =
			useEnvironmentsStore.getState().displayName(link.environmentID) ??
			link.environmentName ??
			link.environmentID;
		manager.setActiveEnvironment(link.environmentID, name);
	}
	if (manager.authState !== 'authenticated') {
		PendingLaunchRoute.set(link.tab);
		return initial ? '/' : null;
	}
	const { available, visible } = visibleTabs();
	const tab = available.has(link.tab) ? link.tab : 'dashboard';
	return tabHref(tab, visible);
}

function shortcutLinkPath(link: ShortcutLink, initial: boolean): string | null {
	if (link.type === 'run') enqueueShortcutAction(link);
	const manager = useClientManager.getState();
	if (manager.authState === 'login' || manager.authState === 'setup') return initial ? '/' : null;
	const tab: AppTab = link.kind === 'container' ? 'containers' : 'projects';
	const { available, visible } = visibleTabs();
	if (manager.authState === 'authenticated' && !available.has(tab)) return initial ? '/' : null;
	const route = itemRoute(link, visible.includes(tab) ? `(${tab})` : '(more)');
	if (manager.authState !== 'authenticated') {
		PendingLaunchRoute.set(tab);
		pendingItemRoute = route;
		return initial ? '/' : null;
	}
	return route;
}

export function redirectSystemPath({
	path,
	initial
}: {
	path: string;
	initial: boolean;
}): string | null {
	if (authCallback.test(path)) return initial ? '/' : null;
	const widgetPath = widgetLinkPath(path, initial);
	if (widgetPath !== undefined) return widgetPath;
	const shortcut = parseShortcutLink(path);
	if (shortcut) return shortcutLinkPath(shortcut, initial);
	return path;
}
