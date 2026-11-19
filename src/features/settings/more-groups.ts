import { tabTitle, type AppTab } from '@/core/app-tab';

export type MoreDestinationGroup = { title: string; tabs: AppTab[] };

export const moreGroups: MoreDestinationGroup[] = [
	{
		title: 'Monitor',
		tabs: [
			'dashboard',
			'updates',
			'events',
			'activities',
			'activityHistory',
			'imageVulnerabilities'
		]
	},
	{
		title: 'Resources',
		tabs: [
			'projects',
			'containers',
			'images',
			'networks',
			'ports',
			'networkTopology',
			'volumes',
			'swarm'
		]
	},
	{
		title: 'Operations',
		tabs: ['gitOps', 'systemBackups', 'variables', 'notifications', 'apiKeys', 'users']
	},
	{
		title: 'Setup',
		tabs: [
			'customize',
			'templateRegistries',
			'containerRegistries',
			'gitRepositories',
			'builds',
			'webhooks',
			'authentication',
			'roles',
			'oidcRoleMappings',
			'federatedCredentials',
			'jobs',
			'timeouts'
		]
	}
];

export function filterMoreGroups(
	groups: readonly MoreDestinationGroup[],
	available: ReadonlySet<AppTab>,
	search: string
): MoreDestinationGroup[] {
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
}
