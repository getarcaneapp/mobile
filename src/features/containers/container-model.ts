/**
 * Pure container helpers shared by the Containers screens: the
 * `ContainerSummary` extensions from Models.swift, `ImageUpdateState(info:)`,
 * `ContainerStateFilter` / `ContainerListSort` (ResourceListFilters.swift),
 * `ResourceUpdateFilter`, `ContainerDetails.navigationSummary`
 * (ContainerNavigation.swift) and the ContainersView section/bulk logic.
 *
 * No React Native imports so it stays unit-testable.
 */
import { parseArcaneDate } from '@/sdk/models/base/date';
import type { ContainerDetails } from '@/sdk/models/container/ContainerDetails';
import {
	ContainerSummary,
	type ContainerResourceSample,
	type ContainerResourceSort
} from '@/sdk/models/container/ContainerSummary';
import { ImageUpdateInfo } from '@/sdk/models/image/ImageUpdateInfo';

// MARK: - ContainerSummary extensions (Models.swift)

export function containerDisplayName(container: Pick<ContainerSummary, 'names' | 'id'>): string {
	const first = trimSlashes(container.names[0] ?? '');
	return first === '' ? container.id.slice(0, 12) : first;
}

export const containerIsRunning = (container: Pick<ContainerSummary, 'state'>) =>
	container.state.toLowerCase() === 'running';

export const containerHasAvailableUpdate = (container: Pick<ContainerSummary, 'updateInfo'>) =>
	container.updateInfo?.hasUpdate === true;

export function trimSlashes(value: string): string {
	return value.replace(/^\/+|\/+$/g, '');
}

function legacyIconUrl(labels: Record<string, string> | undefined): string | undefined {
	return labels?.['com.getarcaneapp.arcane.icon'] ?? labels?.['arcane.icon'];
}

function isDirectURL(value: string): boolean {
	if (value.startsWith('/')) return true;
	const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value)?.[1]?.toLowerCase();
	return scheme === 'http' || scheme === 'https';
}

/** `ThemedIconURL.firstUsableURL`. */
export function firstUsableURL(...values: (string | undefined)[]): string | undefined {
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed && isDirectURL(trimmed)) return trimmed;
	}
	return undefined;
}

/** `themedIconUrl(for:)`: light mode prefers the dark-artwork URL (Swift's ordering). */
export function themedIconUrl(
	value: { iconLightUrl?: string; iconDarkUrl?: string; labels?: Record<string, string> },
	isDark: boolean
): string | undefined {
	const fallback = legacyIconUrl(value.labels);
	return isDark
		? firstUsableURL(value.iconLightUrl, value.iconDarkUrl, fallback)
		: firstUsableURL(value.iconDarkUrl, value.iconLightUrl, fallback);
}

// MARK: - Status parsing (ContainerRow)

const healthTokens = ['(healthy)', '(unhealthy)', '(health: starting)'];

export type ContainerRowHealth = { icon: string; color: 'red' | 'yellow' | 'green'; label: string };

/** Docker reports health inside the status string, e.g. "Up 3 hours (healthy)". */
export function containerHealth(status: string): ContainerRowHealth | undefined {
	const lower = status.toLowerCase();
	if (lower.includes('unhealthy'))
		return { icon: 'heart.slash.fill', color: 'red', label: 'Unhealthy' };
	if (lower.includes('health: starting'))
		return { icon: 'heart.fill', color: 'yellow', label: 'Health starting' };
	if (lower.includes('(healthy)')) return { icon: 'heart.fill', color: 'green', label: 'Healthy' };
	return undefined;
}

/** The status string with the health parenthetical stripped ("Up 3 hours"). */
export function containerStatusText(status: string): string {
	let result = status;
	for (const token of healthTokens) {
		result = result.replace(new RegExp(token.replace(/[()]/g, '\\$&'), 'gi'), '');
	}
	return result.replace(/^[ \t]+|[ \t]+$/g, '');
}

// MARK: - ImageUpdateState(info:)

export type ImageUpdateState =
	| { kind: 'unknown' }
	| { kind: 'upToDate' }
	| { kind: 'hasUpdate' }
	| { kind: 'error'; message: string };

export function imageUpdateState(info: ImageUpdateInfo | undefined): ImageUpdateState {
	if (!info) return { kind: 'unknown' };
	if (info.hasUpdate) return { kind: 'hasUpdate' };
	if (info.error !== '') return { kind: 'error', message: info.error };
	if (ImageUpdateInfo.hasCheckResult(info) || info.checkTime !== undefined)
		return { kind: 'upToDate' };
	return { kind: 'unknown' };
}

export function imageUpdateAccessibility(state: ImageUpdateState): string {
	switch (state.kind) {
		case 'unknown':
			return 'Update status not checked';
		case 'upToDate':
			return 'Up to date';
		case 'hasUpdate':
			return 'Update available';
		case 'error':
			return `Update check failed: ${state.message}`;
	}
}

// MARK: - Filters and sort

export type ContainerStateFilter = 'All' | 'Running' | 'Stopped';
export const ContainerStateFilters: ContainerStateFilter[] = ['All', 'Running', 'Stopped'];

export type ResourceUpdateFilter = 'all' | 'hasUpdates';
export const ResourceUpdateFilters: { id: ResourceUpdateFilter; title: string }[] = [
	{ id: 'all', title: 'All' },
	{ id: 'hasUpdates', title: 'Has Updates' }
];

export const resourceUpdateFilterMatches = (filter: ResourceUpdateFilter, hasUpdate: boolean) =>
	filter === 'all' || hasUpdate;

/** `String.localizedStandardCompare` (Finder-style, numeric-aware, case-insensitive). */
export function localizedStandardCompare(lhs: string, rhs: string): number {
	return lhs.localeCompare(rhs, undefined, { numeric: true, sensitivity: 'base' });
}

export type ContainerListSort = 'nameAscending' | 'nameDescending' | 'cpuUsage' | 'memoryUsage';

export const ContainerListSorts: { id: ContainerListSort; title: string; systemImage: string }[] = [
	{ id: 'nameAscending', title: 'A-Z', systemImage: 'arrow.up' },
	{ id: 'nameDescending', title: 'Z-A', systemImage: 'arrow.down' },
	{ id: 'cpuUsage', title: 'CPU', systemImage: 'cpu' },
	{ id: 'memoryUsage', title: 'Memory', systemImage: 'memorychip' }
];

export function resourceSortFor(sort: ContainerListSort): ContainerResourceSort | undefined {
	return sort === 'cpuUsage' || sort === 'memoryUsage' ? sort : undefined;
}

type SortKey = { name: string; sample?: ContainerResourceSample };

/**
 * `ContainerListSort.areInIncreasingOrder` as a comparator. Resource sorts put
 * the heaviest first and unsampled containers last, falling back to name.
 */
export function compareContainers(sort: ContainerListSort, lhs: SortKey, rhs: SortKey): number {
	switch (sort) {
		case 'nameAscending':
			return localizedStandardCompare(lhs.name, rhs.name);
		case 'nameDescending':
			return localizedStandardCompare(rhs.name, lhs.name);
		case 'cpuUsage':
		case 'memoryUsage': {
			const value = (sample?: ContainerResourceSample) =>
				sample === undefined
					? undefined
					: sort === 'memoryUsage'
						? sample.memoryUsageBytes
						: sample.cpuPercent;
			const l = value(lhs.sample);
			const r = value(rhs.sample);
			if (l !== r) {
				if (l === undefined) return 1;
				if (r === undefined) return -1;
				return r - l;
			}
			return localizedStandardCompare(lhs.name, rhs.name);
		}
	}
}

// MARK: - Sections

export interface ContainerListItem {
	id: string;
	environmentID: string;
	environmentName?: string;
	value: ContainerSummary;
}

export type ContainerFilters = {
	search: string;
	environmentFilter?: string;
	stateFilter: ContainerStateFilter;
	updateFilter: ResourceUpdateFilter;
	showHidden: boolean;
	sort: ContainerListSort;
};

export type ContainerSection<Item> = {
	id: 'pinned' | 'running' | 'stopped';
	title: string;
	items: Item[];
};

const containsCaseInsensitive = (haystack: string, needle: string) =>
	haystack.toLowerCase().includes(needle.toLowerCase());

/**
 * `ContainersView.computeSections(pinned:)`: filters + sorts once and
 * partitions into Pinned / Running / Stopped in a single pass.
 */
export function computeContainerSections<Item extends ContainerListItem>(
	containers: readonly Item[],
	filters: ContainerFilters,
	pinned: ReadonlySet<string>,
	resourceSample: (item: Item) => ContainerResourceSample | undefined
): ContainerSection<Item>[] {
	const query = filters.search;
	const filtered = containers
		.filter((container) => {
			if (
				filters.environmentFilter !== undefined &&
				container.environmentID !== filters.environmentFilter
			)
				return false;
			const matchesSearch =
				query === '' ||
				container.value.names.some((name) => containsCaseInsensitive(name, query)) ||
				containsCaseInsensitive(container.value.image, query);
			const running = containerIsRunning(container.value);
			const matchesState =
				filters.stateFilter === 'All' ||
				(filters.stateFilter === 'Running' && running) ||
				(filters.stateFilter === 'Stopped' && !running);
			const matchesUpdate = resourceUpdateFilterMatches(
				filters.updateFilter,
				containerHasAvailableUpdate(container.value)
			);
			const matchesHidden = filters.showHidden || container.value.hidden !== true;
			return matchesSearch && matchesState && matchesUpdate && matchesHidden;
		})
		// displayName trims on every access; compute it once per item.
		.map((item) => ({
			key: { name: containerDisplayName(item.value), sample: resourceSample(item) },
			item
		}))
		.sort((a, b) => compareContainers(filters.sort, a.key, b.key))
		.map((entry) => entry.item);

	const pinnedItems: Item[] = [];
	const running: Item[] = [];
	const stopped: Item[] = [];
	for (const container of filtered) {
		if (pinned.has(container.id)) pinnedItems.push(container);
		else if (containerIsRunning(container.value)) running.push(container);
		else stopped.push(container);
	}
	return [
		{ id: 'pinned', title: 'Pinned', items: pinnedItems },
		{ id: 'running', title: 'Running', items: running },
		{ id: 'stopped', title: 'Stopped', items: stopped }
	];
}

export function activeFilterCount(
	filters: Omit<ContainerFilters, 'search' | 'sort'> & { labelFilter: string }
): number {
	let count = filters.stateFilter !== 'All' ? 1 : 0;
	if (filters.environmentFilter !== undefined) count += 1;
	if (filters.updateFilter !== 'all') count += 1;
	if (filters.showHidden) count += 1;
	if (filters.labelFilter.trim() !== '') count += 1;
	return count;
}

// MARK: - Bulk actions

export type ContainerBulkAction = 'start' | 'stop' | 'restart';

export const bulkActionInfo: Record<
	ContainerBulkAction,
	{
		id: string;
		title: string;
		summaryVerb: string;
		systemImage: string;
		tint: 'green' | 'red' | 'orange';
	}
> = {
	start: {
		id: 'bulk-start',
		title: 'Start',
		summaryVerb: 'Started',
		systemImage: 'play.fill',
		tint: 'green'
	},
	stop: {
		id: 'bulk-stop',
		title: 'Stop',
		summaryVerb: 'Stopped',
		systemImage: 'stop.fill',
		tint: 'red'
	},
	restart: {
		id: 'bulk-restart',
		title: 'Restart',
		summaryVerb: 'Restarted',
		systemImage: 'arrow.clockwise',
		tint: 'orange'
	}
};

export const bulkActionApplies = (
	action: ContainerBulkAction,
	container: Pick<ContainerSummary, 'state'>
) => (action === 'start' ? !containerIsRunning(container) : containerIsRunning(container));

export function bulkPrimaryAction(
	selected: readonly { value: ContainerSummary }[]
): ContainerBulkAction | undefined {
	if (selected.length === 0) return undefined;
	if (selected.every((item) => !containerIsRunning(item.value))) return 'start';
	if (selected.every((item) => containerIsRunning(item.value))) return 'stop';
	return 'restart';
}

export function bulkInlineActions(
	selected: readonly { value: ContainerSummary }[]
): ContainerBulkAction[] {
	const primary = bulkPrimaryAction(selected);
	if (primary === undefined) return [];
	return (['start', 'stop', 'restart'] as const).filter(
		(action) => action !== primary && selected.some((item) => bulkActionApplies(action, item.value))
	);
}

export const pluralContainers = (count: number) => `${count} container${count === 1 ? '' : 's'}`;

// MARK: - Navigation summary (ContainerNavigation.swift)

export function navigationSummary(details: ContainerDetails): ContainerSummary {
	const created = parseArcaneDate(details.created);
	return ContainerSummary.make({
		id: details.id,
		names: [details.name],
		image: details.image,
		imageId: details.imageId,
		command: details.config.cmd?.join(' ') ?? '',
		created: created ? Math.trunc(created.getTime() / 1000) : 0,
		ports: details.ports,
		labels: details.labels ?? {},
		state: details.state.status,
		status: details.state.status,
		hostConfig: details.hostConfig,
		networkSettings: details.networkSettings,
		mounts: details.mounts,
		iconLightUrl: details.iconLightUrl,
		iconDarkUrl: details.iconDarkUrl,
		redeployDisabled: details.redeployDisabled
	});
}

/** `ContainerSummary(id:image:imageId:state:status:)` placeholder used after create/edit. */
export const placeholderSummary = (id: string) =>
	ContainerSummary.make({ id, image: '', imageId: '', state: '', status: '' });

// MARK: - Formatting

/** `String(format: "%.1f%%", value)`. */
export const percentText = (value: number) => `${value.toFixed(1)}%`;

/** Swift `String.capitalized`: first letter of every word uppercased, the rest lowercased. */
export function capitalized(value: string): string {
	return value
		.toLowerCase()
		.replace(/(^|[^\p{L}\p{N}'])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

// MARK: - Processes (ContainerProcessesView.swift)

export interface ContainerProcessList {
	titles: string[];
	processes: string[][];
}

export interface ProcessRow {
	id: number;
	pid?: string;
	user?: string;
	command?: string;
	extras: { title: string; value: string }[];
}

const pidTitles = new Set(['PID']);
const userTitles = new Set(['USER', 'UID']);
const commandTitles = new Set(['CMD', 'COMMAND', 'ARGS']);

/** `docker top` columns vary by host: pull PID / user / command out when present. */
export function processRow(
	id: number,
	titles: readonly string[],
	values: readonly string[]
): ProcessRow {
	const row: ProcessRow = { id, extras: [] };
	values.forEach((value, index) => {
		const title = index < titles.length ? titles[index]!.toUpperCase() : '';
		if (row.pid === undefined && pidTitles.has(title)) row.pid = value;
		else if (row.user === undefined && userTitles.has(title)) row.user = value;
		else if (row.command === undefined && commandTitles.has(title)) row.command = value;
		else if (value !== '' && value !== '?')
			row.extras.push({ title: index < titles.length ? titles[index]! : '', value });
	});
	return row;
}

export function processRows(list: ContainerProcessList | undefined): ProcessRow[] {
	if (!list) return [];
	return list.processes.map((values, index) => processRow(index, list.titles, values));
}
