import type { SystemColorName } from '@/theme/colors';

/**
 * Every destination represented by the shared app navigation model.
 * Port of `AppTab.swift` — pure data, same ids, titles, symbols, and rules.
 */
export const AppTabIDs = [
	'dashboard',
	'updates',
	'projects',
	'containers',
	'images',
	'imageVulnerabilities',
	'networks',
	'ports',
	'networkTopology',
	'volumes',
	'swarm',
	'events',
	'customize',
	'settings',
	'templateRegistries',
	'containerRegistries',
	'variables',
	'gitRepositories',
	'gitOps',
	'apiKeys',
	'webhooks',
	'authentication',
	'notifications',
	'jobs',
	'users',
	'roles',
	'activities',
	'oidcRoleMappings',
	'systemBackups',
	'federatedCredentials',
	'timeouts',
	'activityHistory',
	'builds'
] as const;

export type AppTab = (typeof AppTabIDs)[number];

export type AppTabSection = 'management' | 'resources' | 'swarm' | 'administration';

export const sectionTitle: Record<AppTabSection, string> = {
	management: 'Management',
	resources: 'Resources',
	swarm: 'Swarm',
	administration: 'Administration'
};

export const tabTitle: Record<AppTab, string> = {
	dashboard: 'Dashboard',
	updates: 'Updates',
	projects: 'Projects',
	containers: 'Containers',
	images: 'Images',
	imageVulnerabilities: 'Security',
	networks: 'Networks',
	ports: 'Ports',
	networkTopology: 'Topology',
	volumes: 'Volumes',
	swarm: 'Swarm',
	events: 'Events',
	customize: 'Customize',
	settings: 'More',
	templateRegistries: 'Templates',
	containerRegistries: 'Container Registries',
	variables: 'Variables',
	gitRepositories: 'Git Repositories',
	gitOps: 'GitOps',
	apiKeys: 'API Keys',
	webhooks: 'Webhooks',
	authentication: 'Authentication',
	notifications: 'Notifications',
	jobs: 'Jobs',
	users: 'Users',
	roles: 'Roles',
	activities: 'Activities',
	systemBackups: 'Backups',
	federatedCredentials: 'Federated Credentials',
	oidcRoleMappings: 'OIDC Role Mappings',
	timeouts: 'Timeouts',
	activityHistory: 'Activity History',
	builds: 'Builds'
};

export function tabBarTitle(tab: AppTab): string {
	switch (tab) {
		case 'containerRegistries':
			return 'Registries';
		case 'gitRepositories':
			return 'Git Repos';
		case 'authentication':
			return 'Auth';
		case 'oidcRoleMappings':
			return 'OIDC Roles';
		case 'activities':
			return 'Activity';
		default:
			return tabTitle[tab];
	}
}

export const systemImage: Record<AppTab, string> = {
	dashboard: 'chart.bar.fill',
	updates: 'arrow.triangle.2.circlepath',
	projects: 'folder.fill',
	containers: 'cube.box.fill',
	images: 'square.3.layers.3d.top.filled',
	imageVulnerabilities: 'shield.lefthalf.filled',
	networks: 'network',
	ports: 'point.3.connected.trianglepath.dotted',
	networkTopology: 'point.topleft.down.curvedto.point.bottomright.up',
	volumes: 'externaldrive.fill',
	swarm: 'square.stack.3d.up',
	events: 'clock.badge.exclamationmark',
	customize: 'paintbrush.pointed.fill',
	settings: 'ellipsis.circle.fill',
	templateRegistries: 'doc.text.fill',
	containerRegistries: 'shippingbox.fill',
	variables: 'curlybraces',
	gitRepositories: 'arrow.triangle.branch',
	gitOps: 'arrow.triangle.merge',
	apiKeys: 'key.fill',
	webhooks: 'link.badge.plus',
	authentication: 'lock.shield.fill',
	notifications: 'bell.badge.fill',
	jobs: 'calendar.badge.clock',
	users: 'person.2.fill',
	roles: 'person.crop.rectangle.stack.fill',
	activities: 'clock.arrow.circlepath',
	systemBackups: 'externaldrive.badge.timemachine',
	federatedCredentials: 'key.horizontal.fill',
	oidcRoleMappings: 'person.badge.key.fill',
	timeouts: 'clock',
	activityHistory: 'list.bullet.rectangle',
	builds: 'hammer.fill'
};

export function iconColor(tab: AppTab): SystemColorName {
	switch (tab) {
		case 'dashboard':
		case 'projects':
		case 'containers':
		case 'images':
		case 'users':
		case 'authentication':
			return 'blue';
		case 'updates':
		case 'webhooks':
			return 'green';
		case 'imageVulnerabilities':
		case 'volumes':
		case 'activities':
		case 'systemBackups':
			return 'orange';
		case 'networks':
		case 'variables':
		case 'activityHistory':
			return 'teal';
		case 'ports':
			return 'cyan';
		case 'networkTopology':
		case 'swarm':
			return 'mint';
		case 'events':
		case 'notifications':
			return 'red';
		case 'customize':
		case 'containerRegistries':
		case 'roles':
			return 'purple';
		case 'settings':
			return 'gray';
		case 'templateRegistries':
		case 'gitRepositories':
		case 'gitOps':
		case 'oidcRoleMappings':
		case 'federatedCredentials':
			return 'indigo';
		case 'apiKeys':
			return 'yellow';
		case 'jobs':
			return 'pink';
		case 'timeouts':
		case 'builds':
			return 'brown';
	}
}

export function section(tab: AppTab): AppTabSection {
	switch (tab) {
		case 'dashboard':
		case 'updates':
		case 'projects':
			return 'management';
		case 'containers':
		case 'images':
		case 'imageVulnerabilities':
		case 'networks':
		case 'ports':
		case 'networkTopology':
		case 'volumes':
			return 'resources';
		case 'swarm':
			return 'swarm';
		default:
			return 'administration';
	}
}

/** Nested destinations owned by this selectable landing page. */
export function children(tab: AppTab): AppTab[] {
	switch (tab) {
		case 'images':
			return ['imageVulnerabilities'];
		case 'networks':
			return ['ports', 'networkTopology'];
		case 'customize':
			return ['templateRegistries', 'containerRegistries', 'variables', 'gitRepositories'];
		case 'settings':
			return [
				'apiKeys',
				'federatedCredentials',
				'systemBackups',
				'webhooks',
				'authentication',
				'notifications',
				'jobs',
				'users',
				'roles',
				'timeouts',
				'activityHistory',
				'builds'
			];
		default:
			return [];
	}
}

export function parent(tab: AppTab): AppTab | undefined {
	switch (tab) {
		case 'imageVulnerabilities':
			return 'images';
		case 'ports':
		case 'networkTopology':
			return 'networks';
		case 'templateRegistries':
		case 'containerRegistries':
		case 'variables':
		case 'gitRepositories':
			return 'customize';
		case 'apiKeys':
		case 'webhooks':
		case 'authentication':
		case 'notifications':
		case 'jobs':
		case 'users':
		case 'roles':
		case 'systemBackups':
		case 'federatedCredentials':
		case 'timeouts':
		case 'activityHistory':
		case 'builds':
			return 'settings';
		default:
			return undefined;
	}
}

export function showsInNavigationMenus(tab: AppTab): boolean {
	return (
		parent(tab) === undefined &&
		tab !== 'activities' &&
		tab !== 'gitOps' &&
		tab !== 'oidcRoleMappings'
	);
}

export const pinnableTabs = [
	'dashboard',
	'updates',
	'projects',
	'containers',
	'images',
	'networks',
	'volumes',
	'events',
	'swarm'
] as const satisfies readonly AppTab[];

export type PinnableTab = (typeof pinnableTabs)[number];

export function canPinToBottomBar(tab: AppTab): tab is PinnableTab {
	return (pinnableTabs as readonly AppTab[]).includes(tab);
}

export function requiresAdmin(tab: AppTab): boolean {
	switch (tab) {
		case 'customize':
		case 'templateRegistries':
		case 'containerRegistries':
		case 'variables':
		case 'gitRepositories':
		case 'gitOps':
		case 'swarm':
		case 'apiKeys':
		case 'webhooks':
		case 'authentication':
		case 'notifications':
		case 'jobs':
		case 'users':
		case 'roles':
		case 'oidcRoleMappings':
		case 'timeouts':
		case 'activityHistory':
		case 'builds':
			return true;
		default:
			return false;
	}
}

export function requiresV2(tab: AppTab): boolean {
	switch (tab) {
		case 'activities':
		case 'activityHistory':
		case 'variables':
		case 'roles':
		case 'oidcRoleMappings':
		case 'systemBackups':
		case 'federatedCredentials':
			return true;
		default:
			return false;
	}
}

export function isEnvironmentScoped(tab: AppTab): boolean {
	switch (tab) {
		case 'containers':
		case 'images':
		case 'imageVulnerabilities':
		case 'projects':
		case 'volumes':
		case 'networks':
		case 'ports':
		case 'networkTopology':
		case 'gitOps':
		case 'jobs':
		case 'swarm':
			return true;
		default:
			return false;
	}
}

export function accessSurfaceIDs(tab: AppTab): string[] {
	switch (tab) {
		case 'dashboard':
			return ['route.dashboard'];
		case 'updates':
			return ['route.updates'];
		case 'projects':
			return ['route.projects'];
		case 'containers':
			return ['route.containers'];
		case 'images':
			return ['route.images'];
		case 'imageVulnerabilities':
			return ['route.images.vulnerabilities'];
		case 'networks':
			return ['route.networks'];
		case 'ports':
			return ['route.ports'];
		case 'networkTopology':
			return ['route.networks.topology'];
		case 'volumes':
			return ['route.volumes'];
		case 'swarm':
			return ['route.swarm'];
		case 'events':
			return ['route.events'];
		case 'customize':
			return [
				'customize.category.templates',
				'customize.category.registries',
				'customize.category.variables',
				'customize.category.git-repositories'
			];
		case 'settings':
			return [
				'settings.category.apikeys',
				'settings.category.webhooks',
				'settings.category.authentication',
				'settings.category.notifications',
				'settings.category.jobschedule',
				'settings.category.users',
				'settings.category.roles',
				'settings.category.appearance',
				'settings.category.build',
				'settings.category.timeouts',
				'settings.category.diagnostics'
			];
		case 'templateRegistries':
			return ['customize.category.templates'];
		case 'containerRegistries':
			return ['customize.category.registries'];
		case 'variables':
			return ['customize.category.variables'];
		case 'gitRepositories':
			return ['customize.category.git-repositories'];
		case 'gitOps':
			return ['route.environments.gitops'];
		case 'apiKeys':
			return ['settings.category.apikeys'];
		case 'webhooks':
			return ['settings.category.webhooks'];
		case 'authentication':
			return ['settings.category.authentication'];
		case 'notifications':
			return ['settings.category.notifications'];
		case 'jobs':
			return ['settings.category.jobschedule'];
		case 'users':
			return ['settings.category.users'];
		case 'roles':
			return ['settings.category.roles'];
		case 'timeouts':
			return ['settings.category.timeouts'];
		case 'activityHistory':
			return ['settings.category.activity'];
		case 'builds':
			return ['settings.category.build'];
		case 'activities':
			return ['route.activities'];
		case 'systemBackups':
			return ['settings.category.systembackups'];
		case 'federatedCredentials':
			return [];
		case 'oidcRoleMappings':
			return ['route.oidc-role-mappings'];
	}
}

export const mainDefaults: PinnableTab[] = ['dashboard', 'containers', 'images', 'projects'];

export function isAppTab(value: string): value is AppTab {
	return (AppTabIDs as readonly string[]).includes(value);
}
