import { AppTabIDs, type AppTab } from '@/core/app-tab';

export type WidgetLink = { tab: AppTab; environmentID?: string; environmentName?: string };

const openLink = /^(?:arcane-mobile:\/\/\/?|\/)open\/?(?:\?([^#]*))?(?:#.*)?$/i;

function decoded(value: string): string | undefined {
	try {
		return decodeURIComponent(value.replace(/\+/g, ' '));
	} catch {
		return undefined;
	}
}

export function parseWidgetLink(path: string): WidgetLink | undefined {
	const match = openLink.exec(path);
	if (!match) return undefined;
	const params = new Map<string, string>();
	for (const pair of (match[1] ?? '').split('&')) {
		if (pair === '') continue;
		const equals = pair.indexOf('=');
		const name = decoded(equals < 0 ? pair : pair.slice(0, equals));
		const value = decoded(equals < 0 ? '' : pair.slice(equals + 1));
		if (name !== undefined && value !== undefined && !params.has(name)) params.set(name, value);
	}
	const rawTab = params.get('tab') ?? 'dashboard';
	const tab = (AppTabIDs as readonly string[]).includes(rawTab) ? (rawTab as AppTab) : 'dashboard';
	const environmentID = params.get('env')?.trim();
	const environmentName = params.get('name')?.trim();
	return {
		tab,
		environmentID: environmentID ? environmentID : undefined,
		environmentName: environmentName ? environmentName : undefined
	};
}

export function tabHref(tab: AppTab, visibleTabs: readonly AppTab[]): string {
	if (tab === 'settings') return '/(tabs)/(more)/more';
	return visibleTabs.includes(tab) ? `/(tabs)/(${tab})/${tab}` : `/(tabs)/(more)/${tab}`;
}

let pendingLaunchTab: AppTab | undefined;

export const PendingLaunchRoute = {
	set(tab: AppTab) {
		pendingLaunchTab = tab;
	},
	peek: (): AppTab | undefined => pendingLaunchTab,
	clear() {
		pendingLaunchTab = undefined;
	}
};
