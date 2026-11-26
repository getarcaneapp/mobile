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
	'podman',
	'imageVulnerabilities'
];

export const workspaceGroups: MoreDestinationGroup[] = [
	{
		title: 'Activity',
		tabs: ['updates', 'events', 'activityHistory']
	},
	{
		title: 'Automation',
		tabs: ['gitOps', 'gitRepositories', 'webhooks', 'jobs', 'builds']
	}
];

export const serverSettingsTitle = 'Server Settings';

export const serverSettingsGroups: MoreDestinationGroup[] = [
	{
		title: 'Users & Access',
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
		title: 'Configuration',
		tabs: [
			'notifications',
			'variables',
			'containerRegistries',
			'templateRegistries',
			'timeouts',
			'tunnel',
			'branding'
		]
	},
	{
		title: 'Maintenance',
		tabs: ['systemBackups', 'diagnostics']
	}
];

export const moreGroups: MoreDestinationGroup[] = [...workspaceGroups, ...serverSettingsGroups];

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
