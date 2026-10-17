import { formattedISO8601 } from '@/core/date-formatting';
import type { ProjectDetails, RuntimeService } from '@/sdk/models/project/Project';
import type { ProjectTag } from '@/sdk/models/project/ProjectTag';
import { systemColors } from '@/theme/colors';

import {
	firstUsableURL,
	localizedStandardCompare,
	resourceUpdateFilterMatches,
	type ResourceUpdateFilter
} from '@/features/containers/container-model';

export const projectDisplayName = (project: Pick<ProjectDetails, 'name'>) => project.name;

export const projectComposeVersion = (_project: ProjectDetails): string | undefined => undefined;

export const projectHasAvailableUpdate = (project: Pick<ProjectDetails, 'updateInfo'>) =>
	project.updateInfo?.hasUpdate === true;

export const projectIsRunning = (project: Pick<ProjectDetails, 'status'>) =>
	project.status.toLowerCase() === 'running';

export function projectIsStopped(project: Pick<ProjectDetails, 'status'>) {
	const status = project.status.toLowerCase();
	return status === 'stopped' || status === 'exited';
}

export function projectStatusColor(status: string): string | undefined {
	switch (status.toLowerCase()) {
		case 'running':
			return systemColors.green;
		case 'stopped':
		case 'exited':
			return systemColors.red;
		case 'partial':
		case 'partially running':
			return systemColors.orange;
		default:
			return undefined;
	}
}

export function projectThemedIconUrl(
	value:
		| Pick<ProjectDetails, 'iconUrl' | 'iconLightUrl' | 'iconDarkUrl'>
		| Pick<RuntimeService, 'iconUrl' | 'iconLightUrl' | 'iconDarkUrl'>,
	isDark: boolean
): string | undefined {
	return isDark
		? firstUsableURL(value.iconLightUrl, value.iconDarkUrl, value.iconUrl)
		: firstUsableURL(value.iconDarkUrl, value.iconLightUrl, value.iconUrl);
}

export function runtimeServiceIconURL(
	service: RuntimeService,
	isDark: boolean
): string | undefined {
	return isDark
		? (service.iconDarkUrl ?? service.iconUrl)
		: (service.iconLightUrl ?? service.iconUrl);
}

export const projectTagColors = [
	'gray',
	'purple',
	'blue',
	'green',
	'yellow',
	'orange',
	'red',
	'pink'
] as const;

export function projectTagDisplayColor(color: string): string {
	switch (color) {
		case 'purple':
			return systemColors.purple;
		case 'blue':
			return systemColors.blue;
		case 'green':
			return systemColors.green;
		case 'yellow':
			return systemColors.yellow;
		case 'orange':
			return systemColors.orange;
		case 'red':
			return systemColors.red;
		case 'pink':
			return systemColors.pink;
		default:
			return systemColors.gray;
	}
}

export const projectTagIsComposeManaged = (tag: ProjectTag) =>
	(tag.sources ?? []).includes('compose');

export type ProjectTagOption = { name: string; color: string };

export const tagOptionAsTag = (option: ProjectTagOption): ProjectTag => ({
	name: option.name,
	color: option.color,
	sources: []
});

export type UpdateProjectTagRequest = { name: string; attached: boolean; color?: string };
export type UpdateProjectTagResponse = { tags?: ProjectTag[] };

export type ProjectStatusFilter = 'All' | 'Running' | 'Stopped' | 'Partial';
export const ProjectStatusFilters: ProjectStatusFilter[] = ['All', 'Running', 'Stopped', 'Partial'];

export type ListSortOrder = 'ascending' | 'descending';
export const ListSortOrders: { id: ListSortOrder; title: string; systemImage: string }[] = [
	{ id: 'ascending', title: 'A-Z', systemImage: 'arrow.up' },
	{ id: 'descending', title: 'Z-A', systemImage: 'arrow.down' }
];

export type ProjectListFilters = {
	search: string;
	environmentFilter?: string;
	statusFilter: ProjectStatusFilter;
	updateFilter: ResourceUpdateFilter;
	sortOrder: ListSortOrder;
};

export type ProjectSection<Item> = {
	id: 'pinned' | 'active' | 'stopped';
	title: string;
	items: Item[];
};

type ProjectListItem = { id: string; environmentID: string; value: ProjectDetails };

const containsCaseInsensitive = (value: string, query: string) =>
	value.toLowerCase().includes(query.toLowerCase());

export function computeProjectSections<Item extends ProjectListItem>(
	projects: readonly Item[],
	filters: ProjectListFilters,
	pinned: ReadonlySet<string>
): ProjectSection<Item>[] {
	const query = filters.search;
	const filtered = projects
		.filter((project) => {
			if (
				filters.environmentFilter !== undefined &&
				project.environmentID !== filters.environmentFilter
			)
				return false;
			const matchesSearch =
				query === '' || containsCaseInsensitive(projectDisplayName(project.value), query);
			const status = project.value.status.toLowerCase();
			const matchesStatus =
				filters.statusFilter === 'All' ||
				(filters.statusFilter === 'Running' && status === 'running') ||
				(filters.statusFilter === 'Stopped' && (status === 'stopped' || status === 'exited')) ||
				(filters.statusFilter === 'Partial' &&
					(status === 'partial' || status === 'partially running'));
			const matchesUpdate = resourceUpdateFilterMatches(
				filters.updateFilter,
				projectHasAvailableUpdate(project.value)
			);
			return matchesSearch && matchesStatus && matchesUpdate;
		})
		.map((item) => ({ name: projectDisplayName(item.value), item }))
		.sort((a, b) =>
			filters.sortOrder === 'ascending'
				? localizedStandardCompare(a.name, b.name)
				: localizedStandardCompare(b.name, a.name)
		)
		.map((entry) => entry.item);

	const pinnedItems: Item[] = [];
	const active: Item[] = [];
	const stopped: Item[] = [];
	for (const project of filtered) {
		if (pinned.has(project.id)) pinnedItems.push(project);
		else if (projectIsStopped(project.value)) stopped.push(project);
		else active.push(project);
	}
	return [
		{ id: 'pinned', title: 'Pinned', items: pinnedItems },
		{ id: 'active', title: 'Active', items: active },
		{ id: 'stopped', title: 'Stopped', items: stopped }
	];
}

export function projectLinks(project: Pick<ProjectDetails, 'urls'>): string[] {
	const seen = new Set<string>();
	const links: string[] = [];
	for (const value of project.urls ?? []) {
		const trimmed = value.trim();
		let url: URL;
		try {
			url = new URL(trimmed);
		} catch {
			continue;
		}
		const scheme = url.protocol.replace(/:$/, '').toLowerCase();
		if (scheme !== 'http' && scheme !== 'https') continue;
		if (url.hostname === '') continue;
		if (seen.has(trimmed)) continue;
		seen.add(trimmed);
		links.push(trimmed);
	}
	return links;
}

export function projectComposeFileName(project: Pick<ProjectDetails, 'composeFileName'>): string {
	const value = project.composeFileName?.trim();
	return value ? value : 'compose.yml';
}

export const projectHeaderDate = (iso: string) => formattedISO8601(iso, 'abbreviated', 'omitted');

export const composeOverrideNames = new Set([
	'compose.override.yaml',
	'compose.override.yml',
	'docker-compose.override.yaml',
	'docker-compose.override.yml'
]);

export function projectRowAccessibility(
	project: ProjectDetails,
	isPinned: boolean,
	environmentName?: string
) {
	const count = project.serviceCount;
	const parts = [projectDisplayName(project)];
	if (isPinned) parts.push('pinned');
	parts.push(project.status);
	parts.push(`${count} service${count === 1 ? '' : 's'}`);
	if (environmentName) parts.push(environmentName);
	return parts.join(', ');
}

export const containerIDMatches = (containerID: string, serviceID: string) =>
	containerID === serviceID ||
	containerID.startsWith(serviceID) ||
	serviceID.startsWith(containerID);

export function archivedDateText(iso: string | undefined): string {
	if (!iso) return 'Archived';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return 'Archived';
	return `Archived ${date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
}

export const defaultComposeStarter =
	'services:\n  app:\n    image: \n    ports:\n      - "8080:80"\n';

export const projectNameFromTemplate = (name: string) => name.toLowerCase().replaceAll(' ', '-');

const variableDefinitionPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?[-?]([^}]*))?\}/g;
const variableReferencePattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?[-?][^}]*)?\}/g;

export function parseEnvDefaults(contents: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const rawLine of contents.split(/[\n\r]+/)) {
		const line = rawLine.trim();
		if (line === '' || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq < 0) continue;
		const key = line.slice(0, eq).trim();
		let value = line.slice(eq + 1).trim();
		if (
			((value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))) &&
			value.length >= 2
		) {
			value = value.slice(1, -1);
		}
		if (key !== '') result[key] = value;
	}
	return result;
}

export function scanComposeVariables(
	compose: string,
	env: string
): { order: string[]; defaults: Record<string, string> } {
	const envDefaults = parseEnvDefaults(env);
	const order: string[] = [];
	const seen = new Set<string>();
	const defaults: Record<string, string> = {};
	for (const match of compose.matchAll(variableDefinitionPattern)) {
		const name = match[1];
		if (name === undefined) continue;
		if (!seen.has(name)) {
			seen.add(name);
			order.push(name);
		}
		if (defaults[name] === undefined && match[2] !== undefined) defaults[name] = match[2];
		if (defaults[name] === undefined && envDefaults[name] !== undefined)
			defaults[name] = envDefaults[name];
	}
	return { order, defaults };
}

export function substituteComposeVariables(
	source: string,
	values: Record<string, string>,
	defaults: Record<string, string>
): string {
	return source.replace(variableReferencePattern, (_whole, name: string) => {
		const value = values[name];
		return (value !== undefined && value !== '' ? value : defaults[name]) ?? '';
	});
}

export function deployOptionsKeyPrefix(serverOrigin: string, environmentID: string): string {
	const bytes = new TextEncoder().encode(serverOrigin);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return `arcane.deployOptions.${btoa(binary)}.${environmentID}`;
}

export const pullPolicyOptions: { value: string; title: string }[] = [
	{ value: 'missing', title: 'If Missing' },
	{ value: 'always', title: 'Always' },
	{ value: 'never', title: 'Never' }
];
