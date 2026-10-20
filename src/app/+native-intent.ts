import { AppTabIDs, type AppTab } from '@/core/app-tab';
import { PendingLaunchRoute, parseWidgetLink, tabHref } from '@/core/widgets/widget-links';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { resolveTabs, useNavTabsStore } from '@/stores/nav-tabs-store';

const authCallback = /^arcane-mobile:\/\/\/?(?:oidc|passkey)-callback(?:[/?#]|$)/i;

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
	const available = new Set<AppTab>(AppTabIDs.filter(manager.canAccess));
	const tab = available.has(link.tab) ? link.tab : 'dashboard';
	return tabHref(tab, resolveTabs(useNavTabsStore.getState().pinnedTabs, available));
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
	return path;
}
