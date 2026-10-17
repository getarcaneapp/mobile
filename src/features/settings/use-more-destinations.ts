import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { AppTabIDs, tabTitle, type AppTab } from '@/core/app-tab';
import { useClientManager } from '@/stores/client-manager';
import { resolveTabs, useNavTabsStore } from '@/stores/nav-tabs-store';

export type MoreDestinationGroup = { title: string; tabs: AppTab[] };

const groups: MoreDestinationGroup[] = [
	{ title: 'Management', tabs: ['dashboard', 'updates', 'projects'] },
	{
		title: 'Resources',
		tabs: [
			'containers',
			'images',
			'imageVulnerabilities',
			'networks',
			'ports',
			'networkTopology',
			'volumes',
			'swarm'
		]
	},
	{
		title: 'Administration',
		tabs: [
			'events',
			'activities',
			'customize',
			'templateRegistries',
			'containerRegistries',
			'variables',
			'gitRepositories',
			'gitOps'
		]
	},
	{
		title: 'Server Settings',
		tabs: [
			'apiKeys',
			'federatedCredentials',
			'systemBackups',
			'webhooks',
			'authentication',
			'oidcRoleMappings',
			'notifications',
			'jobs',
			'users',
			'roles',
			'activityHistory',
			'timeouts',
			'builds'
		]
	}
];

/** Shared state for the More tab (`SettingsView`). */
export function useMoreDestinations(search: string) {
	const router = useRouter();
	const canAccess = useClientManager((s) => s.canAccess);
	useClientManager((s) => s.accessGeneration);
	const pinned = useNavTabsStore((s) => s.pinnedTabs);

	const available = useMemo(() => new Set<AppTab>(AppTabIDs.filter(canAccess)), [canAccess]);
	const visibleTabs = useMemo(
		() => new Set<AppTab>(resolveTabs(pinned, available)),
		[pinned, available]
	);

	const filteredGroups = useMemo(() => {
		const query = search.trim().toLocaleLowerCase();
		return groups.flatMap((group) => {
			const accessible = group.tabs.filter((tab) => available.has(tab));
			const matches = query
				? accessible.filter(
						(tab) =>
							tabTitle[tab].toLocaleLowerCase().includes(query) ||
							group.title.toLocaleLowerCase().includes(query)
					)
				: accessible;
			return matches.length ? [{ title: group.title, tabs: matches }] : [];
		});
	}, [search, available]);

	/** Pinned destinations switch tabs; everything else pushes onto More's stack. */
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
