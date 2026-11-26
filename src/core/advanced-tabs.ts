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
	'tunnel',
	'branding',
	'jobs'
]);

export const advancedFeaturesTitle = 'Editing and Setup';
export const advancedFeaturesDescription =
	'Shows actions to create and edit containers, project and volume files, Swarm resources, GitOps syncs, API keys and backup policies, and the Templates, Registries, Git Repositories, Builds, Webhooks, Jobs, Authentication, Roles, Timeouts, Agent Tunnel and Branding screens.';

export const isAdvancedTab = (tab: AppTab) => advancedTabs.has(tab);

export function initialAdvancedFeatures(stored: boolean | undefined, hasSavedServer: boolean) {
	return stored ?? hasSavedServer;
}
