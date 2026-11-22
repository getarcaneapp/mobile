import { tabTitle, type AppTab } from '@/core/app-tab';

export type MoreDestinationGroup = { title: string; tabs: AppTab[] };

export const resourcesTitle = 'Resources';

export const moreTiles: AppTab[] = [
	'dashboard',
	'projects',
	'containers',
	'images',
	'networks',
	'ports',
	'networkTopology',
	'volumes',
	'swarm',
	'imageVulnerabilities'
];

export const moreGroups: MoreDestinationGroup[] = [
	{
		title: 'Activity',
		tabs: ['updates', 'events', 'activityHistory']
	},
	{
		title: 'Automation',
		tabs: ['gitOps', 'gitRepositories', 'webhooks', 'jobs', 'builds']
	},
	{
		title: 'Access',
		tabs: [
			'users',
			'roles',
			'apiKeys',
			'authentication',
			'oidcRoleMappings',
			'federatedCredentials'
		]
	},
	{
		title: 'Server',
		tabs: [
			'systemBackups',
			'notifications',
			'variables',
			'templateRegistries',
			'containerRegistries',
			'timeouts'
		]
	}
];

export const moreTileColumns = 3;

export function tileRows(tabs: readonly AppTab[]): (AppTab | undefined)[][] {
	const rows: (AppTab | undefined)[][] = [];
	for (let index = 0; index < tabs.length; index += moreTileColumns) {
		const row: (AppTab | undefined)[] = tabs.slice(index, index + moreTileColumns);
		while (row.length < moreTileColumns) row.push(undefined);
		rows.push(row);
	}
	return rows;
}

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
