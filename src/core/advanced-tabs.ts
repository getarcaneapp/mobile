import type { AppTab } from '@/core/app-tab';

export const advancedTabs: ReadonlySet<AppTab> = new Set<AppTab>([
	'customize',
	'templateRegistries',
	'containerRegistries',
	'gitRepositories',
	'builds',
	'webhooks',
	'roles',
	'oidcRoleMappings',
	'federatedCredentials',
	'authentication',
	'timeouts',
	'jobs'
]);

export const isAdvancedTab = (tab: AppTab) => advancedTabs.has(tab);

export function initialAdvancedFeatures(stored: boolean | undefined, hasSavedServer: boolean) {
	return stored ?? hasSavedServer;
}
