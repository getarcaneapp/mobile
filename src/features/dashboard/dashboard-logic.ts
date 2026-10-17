/**
 * Pure pieces of the dashboard (DashboardView.swift, AllEnvironmentsDashboard.swift,
 * DashboardTotalsTile.swift, EnvironmentsView.swift `EnvironmentListRow`,
 * NeedsAttentionSection.swift). Free of RN imports so they're unit-testable.
 */
import { formatFileBytes } from '@/core/networking/remote-data-limits';
import { parseArcaneDate } from '@/sdk/models/base/date';
import type { Activity } from '@/sdk/models/activity/Activity';
import type { ActionItemKind, ActionItems } from '@/sdk/models/dashboard';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import type { PruneAllResult } from '@/sdk/models/system/Prune';
import type { SystemStats } from '@/sdk/models/system/SystemStats';
import type { VersionInfo } from '@/sdk/models/version/VersionInfo';
import {
	DockerCounts,
	environmentIsOnline,
	SystemStatsDisplay,
	type AttentionSummary,
	type DashboardEnvironmentState,
	type SparklineSample
} from '@/stores/dashboard-stream-logic';

// MARK: - Formatting

/** Swift `Int64.byteString` (`ByteCountFormatter`, `.file`). */
export const byteString = formatFileBytes;

/** `String(format: "%.0f%%", value)`. */
export const percent0 = (value: number) => `${value.toFixed(0)}%`;
/** `String(format: "%.1f%%", value)`. */
export const percent1 = (value: number) => `${value.toFixed(1)}%`;

/** Swift `Environment.displayName`. */
export function displayName(environment: Pick<Environment, 'id' | 'name'>): string {
	return environment.name ? environment.name : `Environment ${environment.id}`;
}

/** `env.name ?? env.id`. */
export const nameOrID = (environment: Pick<Environment, 'id' | 'name'>) =>
	environment.name ?? environment.id;

// MARK: - Greeting

export function greetings(firstName: string, hour: number): string[] {
	const timeOfDay =
		hour >= 5 && hour < 12
			? 'Good morning'
			: hour >= 12 && hour < 17
				? 'Good afternoon'
				: 'Good evening';
	return [
		`Hey, ${firstName}`,
		`Hi, ${firstName}`,
		`Hello, ${firstName}`,
		`Welcome back, ${firstName}`,
		`${timeOfDay}, ${firstName}`
	];
}

/** Greetings already shown this launch, keyed by user, so tab switches keep the same greeting. */
const shownGreetings = new Map<string, string>();
/** Greetings that already typed themselves in this launch. */
export const typedGreetings = new Set<string>();

export function greetingFor(
	userName: string | undefined,
	random: () => number = Math.random,
	now = new Date()
): string {
	if (!userName) return '';
	const shown = shownGreetings.get(userName);
	if (shown) return shown;
	const firstName = userName.split(' ').filter(Boolean)[0] ?? userName;
	const options = greetings(firstName, now.getHours());
	const greeting = options[Math.floor(random() * options.length)] ?? `Hey, ${firstName}`;
	shownGreetings.set(userName, greeting);
	return greeting;
}

// MARK: - Live counts

/**
 * Aggregated container/image counts derived live from per-environment
 * `system/docker/info` (dashboard snapshots exclude Arcane-managed containers).
 */
export type DashboardLiveCounts = {
	running: number;
	stopped: number;
	total: number;
	images: number;
};

/** `DashboardEnvironmentLiveState`: docker info when online, undefined when offline. */
export type DashboardEnvironmentLiveStates = Readonly<Record<string, DockerInfo | null>>;

export function liveStatesFrom(
	enabledEnvironments: readonly Pick<Environment, 'id'>[],
	dockerInfo: Readonly<Record<string, DockerInfo>>
): DashboardEnvironmentLiveStates {
	return Object.fromEntries(enabledEnvironments.map((e) => [e.id, dockerInfo[e.id] ?? null]));
}

/** Every enabled environment must be online; any offline one invalidates the total. */
export function aggregateLiveCounts(
	states: DashboardEnvironmentLiveStates,
	expectedCount: number
): DashboardLiveCounts | undefined {
	const values = Object.values(states);
	if (expectedCount <= 0 || values.length !== expectedCount) return undefined;
	const aggregate = { running: 0, stopped: 0, total: 0, images: 0 };
	for (const info of values) {
		if (!info) return undefined;
		aggregate.running += DockerCounts.containersRunning(info);
		aggregate.stopped += DockerCounts.containersStopped(info);
		aggregate.total += DockerCounts.containers(info);
		aggregate.images += DockerCounts.images(info);
	}
	return aggregate;
}

/** The active environment first, then the first `visibleCount`. */
export function dashboardEnvironments<E extends Pick<Environment, 'id'>>(
	envs: readonly E[],
	activeID: string,
	visibleCount: number
): E[] {
	const ordered = [...envs];
	const index = ordered.findIndex((e) => e.id === activeID);
	if (index >= 0) {
		const [active] = ordered.splice(index, 1);
		if (active) ordered.unshift(active);
	}
	return ordered.slice(0, visibleCount);
}

export const environmentBatchSize = 50;
/** Counts that aren't streamed refresh when the dashboard reappears after this long (ms). */
export const reappearRefreshIntervalMs = 60_000;

/**
 * Port of `DashboardImageUpdateCountResolver`: summary sources first. The
 * stream's action-item tally counts resources and lags the server reconcile.
 */
export function resolveImageUpdateCount(
	shared?: number,
	streamed?: number,
	supplemental?: number
): number | undefined {
	return shared ?? supplemental ?? streamed;
}

/** Port of `DashboardLiveStatsLimitPresentation`. */
export function liveStatsLimitMessage(
	enabledEnvironmentCount: number,
	maximumStreams: number
): string | undefined {
	if (maximumStreams <= 0 || enabledEnvironmentCount <= maximumStreams) return undefined;
	return `Live CPU, memory, and disk metrics stream for the first ${maximumStreams} enabled environments. Change this in App Settings. Container and image counts still load for every environment.`;
}

// MARK: - Count availability

export type DashboardCountIssue = { id: string; title: string; detail: string };

export function environmentSummary(
	ids: readonly string[],
	allEnvironments: readonly Pick<Environment, 'id' | 'name'>[]
): string {
	const namesByID = new Map(allEnvironments.map((e) => [e.id, e.name ?? e.id]));
	const names = ids.map((id) => namesByID.get(id) ?? id);
	const visible = names.slice(0, 2);
	const summary = visible.join(visible.length === 2 ? ' and ' : '');
	const remaining = names.length - visible.length;
	return remaining > 0 ? `${summary} and ${remaining} more` : summary;
}

export function countAvailabilityIssues(input: {
	hasLoadedEnvironmentCounts: boolean;
	allEnvironments: readonly Pick<Environment, 'id' | 'name' | 'enabled'>[];
	liveStates: DashboardEnvironmentLiveStates;
	liveCounts: DashboardLiveCounts | undefined;
	volumeCountUnavailableEnvironmentIDs: readonly string[];
	updateCountUnavailableEnvironmentIDs: readonly string[];
	hasStreamAggregate: boolean;
}): DashboardCountIssue[] {
	if (!input.hasLoadedEnvironmentCounts) return [];
	const issues: DashboardCountIssue[] = [];
	const dockerUnavailableIDs = input.allEnvironments
		.filter((e) => e.enabled)
		.filter((e) => !input.liveStates[e.id])
		.map((e) => e.id);
	if (!input.liveCounts && dockerUnavailableIDs.length > 0) {
		issues.push({
			id: 'docker',
			title: 'Container and image counts',
			detail: `Docker information could not be loaded from ${environmentSummary(dockerUnavailableIDs, input.allEnvironments)}.`
		});
	}
	if (input.volumeCountUnavailableEnvironmentIDs.length > 0) {
		issues.push({
			id: 'volumes',
			title: 'Volume count',
			detail: `Volume totals could not be loaded from ${environmentSummary(input.volumeCountUnavailableEnvironmentIDs, input.allEnvironments)}.`
		});
	}
	if (!input.hasStreamAggregate && input.updateCountUnavailableEnvironmentIDs.length > 0) {
		issues.push({
			id: 'updates',
			title: 'Update count',
			detail: `Image update totals could not be loaded from ${environmentSummary(input.updateCountUnavailableEnvironmentIDs, input.allEnvironments)}.`
		});
	}
	return issues;
}

// MARK: - Needs attention

export type AttentionSeverity = 'critical' | 'warning';

export const severityTitle: Record<AttentionSeverity, string> = {
	critical: 'Critical',
	warning: 'Warnings'
};

/** What tapping an attention row does; DashboardView maps these to routes and sheets. */
export type AttentionAction =
	| { kind: 'environment'; id: string; name: string }
	| { kind: 'vulnerabilities'; id: string; name: string }
	| { kind: 'containersTab' }
	| { kind: 'imageUpdates' }
	| { kind: 'apiKeys' }
	| { kind: 'activityCenter' };

/** Port of `NeedsAttentionItem` (the action is data so this stays pure). */
export type NeedsAttentionItem = {
	id: string;
	detail: string;
	severity: AttentionSeverity;
	icon: string;
	title: string;
	count: number;
	action: AttentionAction;
	/** True when the action presents a sheet (needs the popover/sheet to finish dismissing first). */
	presentsSheet: boolean;
};

/** DashboardView `needsAttentionItems`: folded from data the dashboard already holds. */
export function needsAttentionItems(input: {
	attention: AttentionSummary;
	allEnvironments: readonly Pick<Environment, 'id' | 'name'>[];
	allEnvironmentsPreview: boolean;
	imageUpdatesTotal: number | undefined;
	failedActivityCount: number;
}): NeedsAttentionItem[] {
	const { attention, allEnvironments } = input;
	const items: NeedsAttentionItem[] = [];

	const erroring = allEnvironments.filter((e) => attention.erroringEnvironmentIDs.has(e.id));
	const first = erroring[0];
	if (first) {
		items.push({
			id: 'offline-environments',
			detail: 'Live data is unavailable until the environment reconnects.',
			severity: 'critical',
			icon: 'wifi.exclamationmark',
			title: erroring.length === 1 ? `${nameOrID(first)} unreachable` : 'Environments unreachable',
			count: erroring.length,
			action: { kind: 'environment', id: first.id, name: nameOrID(first) },
			presentsSheet: false
		});
	}

	const vulnerableID = attention.mostVulnerableEnvironmentID;
	if (attention.vulnerabilities > 0 && vulnerableID !== undefined) {
		const name = allEnvironments.find((e) => e.id === vulnerableID)?.name ?? vulnerableID;
		items.push({
			id: 'vulnerabilities',
			detail: input.allEnvironmentsPreview
				? 'Open vulnerability reports across all enabled environments.'
				: 'Open the vulnerability report for the most affected environment.',
			severity: attention.hasCriticalVulnerabilities ? 'critical' : 'warning',
			icon: 'exclamationmark.shield.fill',
			title: 'Actionable vulnerabilities',
			count: attention.vulnerabilities,
			action: { kind: 'vulnerabilities', id: vulnerableID, name },
			presentsSheet: false
		});
	}
	if (attention.stoppedContainers > 0) {
		items.push({
			id: 'stopped-containers',
			detail: 'Review containers that are not running.',
			severity: 'warning',
			icon: 'stop.fill',
			title: 'Stopped containers',
			count: attention.stoppedContainers,
			action: { kind: 'containersTab' },
			presentsSheet: false
		});
	}
	// Prefer the summary-based count (same source as the Updates tile).
	const imageUpdates = input.imageUpdatesTotal ?? attention.imageUpdates;
	if (imageUpdates > 0) {
		items.push({
			id: 'image-updates',
			detail: 'Newer images are available to pull.',
			severity: 'warning',
			icon: 'arrow.triangle.2.circlepath',
			title: 'Image updates available',
			count: imageUpdates,
			action: { kind: 'imageUpdates' },
			presentsSheet: true
		});
	}
	if (attention.expiringKeys > 0) {
		items.push({
			id: 'expiring-keys',
			detail: 'Rotate API keys before they expire.',
			severity: 'warning',
			icon: 'key.fill',
			title: 'API keys expiring soon',
			count: attention.expiringKeys,
			action: { kind: 'apiKeys' },
			presentsSheet: false
		});
	}
	if (input.failedActivityCount > 0) {
		items.push({
			id: 'failed-activities',
			detail: 'Open the Activity Center to inspect failures.',
			severity: 'critical',
			icon: 'exclamationmark.triangle.fill',
			title: 'Failed activities',
			count: input.failedActivityCount,
			action: { kind: 'activityCenter' },
			presentsSheet: true
		});
	}
	return items;
}

/** `AttentionToolbarButton` glyph and tint. */
export function attentionButtonAppearance(items: readonly NeedsAttentionItem[]): {
	symbol: string;
	tint: 'red' | 'orange' | 'green';
} {
	return {
		symbol: items.length === 0 ? 'checkmark.shield.fill' : 'exclamationmark.triangle.fill',
		tint: items.some((i) => i.severity === 'critical')
			? 'red'
			: items.length === 0
				? 'green'
				: 'orange'
	};
}

// MARK: - Failed activities

/** `activity.sourceEnvironmentKey`. */
export function sourceEnvironmentKey(activity: Activity): string {
	const source = activity.sourceEnvironmentID?.trim() ?? '';
	if (source) return source;
	const environment = activity.environmentID.trim();
	return environment ? environment : '0';
}

/** `activity.sortTime` as ms. */
export function activitySortTime(activity: Activity): number {
	const raw = activity.updatedAt ?? activity.endedAt ?? activity.startedAt;
	return parseArcaneDate(raw)?.getTime() ?? 0;
}

/** Port of `ActivityHistoryClearFilter.retainingActiveActivities`. */
export function retainingActiveActivities(
	activities: readonly Activity[],
	clearedEnvironmentIDs: ReadonlySet<string>
): Activity[] {
	return activities.filter(
		(a) =>
			!clearedEnvironmentIDs.has(sourceEnvironmentKey(a)) ||
			a.status === 'queued' ||
			a.status === 'running'
	);
}

/** Fills missing source environment fields, then keeps the newest three. */
export function mergeFailedActivities(
	perEnvironment: readonly { id: string; name: string; activities: Activity[] }[]
): Activity[] {
	const merged = perEnvironment.flatMap(({ id, name, activities }) =>
		activities.map((activity) => ({
			...activity,
			sourceEnvironmentID: activity.sourceEnvironmentID?.trim() ? activity.sourceEnvironmentID : id,
			sourceEnvironmentName: activity.sourceEnvironmentName?.trim()
				? activity.sourceEnvironmentName
				: name
		}))
	);
	return merged.sort((a, b) => activitySortTime(b) - activitySortTime(a)).slice(0, 3);
}

// MARK: - Totals tiles (DashboardTotalsTile.swift)

export type DashboardTotalsTile =
	| 'running'
	| 'stopped'
	| 'images'
	| 'volumes'
	| 'updates'
	| 'vulnerabilities'
	| 'hostsOnline'
	| 'cpuCores'
	| 'memory';

type TileInfo = {
	title: string;
	systemImage: string;
	tint: TileTint;
	opensDestination: boolean;
	detail: string;
};
export type TileTint = 'orange' | 'gray' | 'purple' | 'blue' | 'green' | 'red' | 'teal';

export const DashboardTotalsTile = {
	preferenceKey: 'arcane.dashboardTiles',
	defaults: ['running', 'images', 'volumes'] as DashboardTotalsTile[],
	/** One row of tiles stays legible on an iPhone up to four. */
	maximum: 4,
	allCases: [
		'running',
		'stopped',
		'images',
		'volumes',
		'updates',
		'vulnerabilities',
		'hostsOnline',
		'cpuCores',
		'memory'
	] as DashboardTotalsTile[],
	info: {
		running: {
			title: 'Running',
			systemImage: 'cube.box.fill',
			tint: 'orange',
			opensDestination: true,
			detail: 'Running out of all containers'
		},
		stopped: {
			title: 'Stopped',
			systemImage: 'stop.circle.fill',
			tint: 'gray',
			opensDestination: true,
			detail: 'Containers not running'
		},
		images: {
			title: 'Images',
			systemImage: 'square.3.layers.3d.top.filled',
			tint: 'purple',
			opensDestination: true,
			detail: 'Images on every host'
		},
		volumes: {
			title: 'Volumes',
			systemImage: 'externaldrive.fill',
			tint: 'blue',
			opensDestination: true,
			detail: 'Volumes on every host'
		},
		updates: {
			title: 'Updates',
			systemImage: 'arrow.triangle.2.circlepath',
			tint: 'green',
			opensDestination: true,
			detail: 'Images with an update available'
		},
		vulnerabilities: {
			title: 'Vulnerabilities',
			systemImage: 'exclamationmark.shield.fill',
			tint: 'red',
			opensDestination: true,
			detail: 'Actionable vulnerabilities'
		},
		hostsOnline: {
			title: 'Online',
			systemImage: 'server.rack',
			tint: 'teal',
			opensDestination: false,
			detail: 'Environments online'
		},
		cpuCores: {
			title: 'CPU Cores',
			systemImage: 'cpu.fill',
			tint: 'blue',
			opensDestination: false,
			detail: 'Cores across live hosts'
		},
		memory: {
			title: 'Memory',
			systemImage: 'memorychip.fill',
			tint: 'purple',
			opensDestination: false,
			detail: 'Memory in use across live hosts'
		}
	} satisfies Record<DashboardTotalsTile, TileInfo>,

	/** Drops unknown and repeated tiles; an empty result falls back to the defaults. */
	decode(raw: string): DashboardTotalsTile[] {
		const seen = new Set<DashboardTotalsTile>();
		const tiles = raw
			.split(',')
			.filter((value): value is DashboardTotalsTile =>
				(DashboardTotalsTile.allCases as string[]).includes(value)
			)
			.filter((tile) => (seen.has(tile) ? false : (seen.add(tile), true)));
		return tiles.length === 0
			? [...DashboardTotalsTile.defaults]
			: tiles.slice(0, DashboardTotalsTile.maximum);
	},

	encode(tiles: readonly DashboardTotalsTile[]): string {
		return tiles.join(',');
	}
} as const;

/** All-environment totals from the dashboard's existing count sources (`AllEnvironmentsDashboard.Counts`). */
export type AllEnvironmentsCounts = {
	running?: number;
	total?: number;
	images?: number;
	volumes?: number;
	updates?: number;
	vulnerabilities?: number;
};

export function stoppedCount(counts: AllEnvironmentsCounts): number | undefined {
	return counts.running !== undefined && counts.total !== undefined
		? counts.total - counts.running
		: undefined;
}

export function tileValue(
	tile: DashboardTotalsTile,
	counts: AllEnvironmentsCounts,
	environments: readonly Pick<Environment, 'status'>[],
	live: readonly SystemStats[]
): string {
	const count = (value: number | undefined) => (value === undefined ? '—' : String(value));
	switch (tile) {
		case 'running':
			return counts.running !== undefined && counts.total !== undefined
				? `${counts.running} / ${counts.total}`
				: '—';
		case 'stopped':
			return count(stoppedCount(counts));
		case 'images':
			return count(counts.images);
		case 'volumes':
			return count(counts.volumes);
		case 'updates':
			return count(counts.updates);
		case 'vulnerabilities':
			return count(counts.vulnerabilities);
		case 'hostsOnline':
			return `${environments.filter(environmentIsOnline).length} / ${environments.length}`;
		case 'cpuCores':
			return live.length === 0
				? '—'
				: String(live.reduce((total, stats) => total + stats.cpuCount, 0));
		case 'memory': {
			const total = live.reduce((sum, stats) => sum + stats.memoryTotal, 0);
			if (total <= 0) return '—';
			const used = live.reduce((sum, stats) => sum + stats.memoryUsage, 0);
			return percent0((used / total) * 100);
		}
	}
}

// MARK: - Live usage chart

export type UsageMetric = 'CPU' | 'Memory';

/** The chart's visible span (s); matches the history store's five-minute window. */
export const usageWindowSeconds = 300;

/** Snaps the window's right edge to the stream's 2s cadence (ms in, ms out). */
export function windowEnd(newest: number, stepSeconds = 2): number {
	const step = stepSeconds * 1000;
	return Math.floor(newest / step) * step;
}

/** Exponential moving average for display: raw 2s host samples read as noise. */
export function smoothed(samples: readonly SparklineSample[], weight = 0.35): SparklineSample[] {
	let average: number | undefined;
	return samples.map((sample) => {
		const next = average === undefined ? sample.value : average + weight * (sample.value - average);
		average = next;
		return { timestamp: sample.timestamp, value: next };
	});
}

export function usageHeadline(
	metric: UsageMetric,
	stats: readonly SystemStats[]
): { value: string; detail: string } | undefined {
	if (stats.length === 0) return undefined;
	const hosts = stats.length === 1 ? '1 environment' : `${stats.length} environments`;
	if (metric === 'CPU') {
		// Weighted by cores so a busy 2-core box doesn't read like a busy 64-core one.
		const cores = stats.reduce((total, s) => total + Math.max(s.cpuCount, 1), 0);
		const weighted = stats.reduce(
			(total, s) => total + SystemStatsDisplay.cpuPercent(s) * Math.max(s.cpuCount, 1),
			0
		);
		return { value: percent1(weighted / cores), detail: `${hosts} · ${cores} cores` };
	}
	const used = stats.reduce((total, s) => total + s.memoryUsage, 0);
	const total = stats.reduce((sum, s) => sum + s.memoryTotal, 0);
	if (total <= 0) return undefined;
	return {
		value: percent0((used / total) * 100),
		detail: `${byteString(used)} of ${byteString(total)} · ${hosts}`
	};
}

/** Fallback palette slot when an environment has no chosen color. */
export const fallbackEnvironmentColors = [
	'blue',
	'orange',
	'pink',
	'teal',
	'indigo',
	'yellow',
	'cyan',
	'brown'
] as const;

// MARK: - Environment rows (EnvironmentListRow)

/** Snapshot gated on the one-way loaded latch. */
export const loadedSnapshot = (state: DashboardEnvironmentState | undefined) =>
	state?.hasLoaded ? state.snapshot : undefined;

export function actionCount(items: ActionItems | undefined, kind: ActionItemKind): number {
	return items?.items.find((item) => item.kind === kind)?.count ?? 0;
}

export function actionCountText(items: ActionItems | undefined, kind: ActionItemKind): string {
	return items ? String(actionCount(items, kind)) : '—';
}

const nonEmpty = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

export function environmentRowSubtitle(
	state: DashboardEnvironmentState | undefined,
	dockerInfo: DockerInfo | undefined
): string {
	const snapshot = loadedSnapshot(state);
	const version =
		nonEmpty(snapshot?.versionInfo?.displayVersion) ??
		nonEmpty(dockerInfo ? DockerCounts.serverVersion(dockerInfo) : undefined) ??
		'Version unavailable';
	const issue = state?.streamError ? 'Partial data' : dockerInfo ? undefined : 'Unavailable';
	return [version, issue].filter(Boolean).join(' · ');
}

export function environmentStatusTint(
	state: DashboardEnvironmentState | undefined,
	dockerInfo: DockerInfo | undefined
): 'orange' | 'secondary' | 'green' {
	if (state?.streamError) return 'orange';
	if (!dockerInfo && !loadedSnapshot(state)) return 'secondary';
	return 'green';
}

export function environmentRowCounts(
	state: DashboardEnvironmentState | undefined,
	dockerInfo: DockerInfo | undefined
) {
	const snapshot = loadedSnapshot(state);
	return {
		running:
			snapshot?.containers.counts.runningContainers ??
			(dockerInfo ? DockerCounts.containersRunning(dockerInfo) : 0),
		total:
			snapshot?.containers.counts.totalContainers ??
			(dockerInfo ? DockerCounts.containers(dockerInfo) : 0),
		images:
			snapshot?.imageUsageCounts.totalImages ?? (dockerInfo ? DockerCounts.images(dockerInfo) : 0)
	};
}

export function memoryPercentFor(
	stats: SystemStats | undefined,
	dockerInfo: DockerInfo | undefined
): number | undefined {
	if (!stats) return undefined;
	const direct = SystemStatsDisplay.memoryPercent(stats);
	if (direct !== undefined) return direct;
	const total = dockerInfo ? DockerCounts.memTotal(dockerInfo) : undefined;
	return total !== undefined && total > 0 ? (stats.memoryUsage / total) * 100 : undefined;
}

/** Port of `DashboardVersionBadgeFormatter.arcane`. */
export function arcaneVersionBadge(
	info: Pick<VersionInfo, 'displayVersion' | 'currentTag' | 'currentVersion'>
): string {
	const raw = info.displayVersion || info.currentTag || info.currentVersion;
	if (!raw) return '—';
	return raw.startsWith('v') ? raw : `v${raw}`;
}

// MARK: - System prune (SystemPruneView)

export function formatPruneResult(result: PruneAllResult): string {
	const parts: string[] = [];
	const add = (n: number | undefined, noun: string) => {
		if (n !== undefined && n > 0) parts.push(`${n} ${noun}${n === 1 ? '' : 's'}`);
	};
	add(result.containersPruned?.length, 'container');
	add(result.imagesDeleted?.length, 'image');
	add(result.volumesDeleted?.length, 'volume');
	add(result.networksDeleted?.length, 'network');
	let summary = parts.length === 0 ? 'Nothing to remove.' : `Removed ${parts.join(', ')}.`;
	if (result.spaceReclaimed > 0) summary += ` Freed ${byteString(result.spaceReclaimed)}.`;
	if (result.errors && result.errors.length > 0)
		summary += `\nErrors: ${result.errors.slice(0, 3).join('; ')}`;
	return summary;
}

// MARK: - Container / project presentation (Models.swift)

/** `ContainerSummary.displayName`. */
export function containerDisplayName(container: { names: string[]; id: string }): string {
	const first = (container.names[0] ?? '').replace(/^\/+|\/+$/g, '');
	return first ? first : container.id.slice(0, 12);
}

/** `ContainerSummary.isRunning`. */
export const containerIsRunning = (container: { state: string }) =>
	container.state.toLowerCase() === 'running';

/** `ProjectDetails.isDashboardRunning`. */
export const projectIsRunning = (project: { status: string }) =>
	project.status.toLowerCase() === 'running';

/** Swift `String.capitalized`. */
export const capitalized = (value: string) =>
	value
		.toLowerCase()
		.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());

/** Docker reports health inside the status string ("Up 3 hours (healthy)"). */
export function containerHealth(
	status: string
): { icon: string; color: 'red' | 'yellow' | 'green'; label: string } | undefined {
	const lower = status.toLowerCase();
	if (lower.includes('unhealthy'))
		return { icon: 'heart.slash.fill', color: 'red', label: 'Unhealthy' };
	if (lower.includes('health: starting'))
		return { icon: 'heart.fill', color: 'yellow', label: 'Health starting' };
	if (lower.includes('(healthy)')) return { icon: 'heart.fill', color: 'green', label: 'Healthy' };
	return undefined;
}

/** The status string with the health parenthetical stripped. */
export function containerStatusText(status: string): string {
	let text = status;
	for (const token of ['(healthy)', '(unhealthy)', '(health: starting)']) {
		text = text.replace(new RegExp(token.replace(/[()]/g, '\\$&'), 'gi'), '');
	}
	return text.trim();
}

/** `container.themedIconUrl(for:)`: the light/dark icon, else the legacy icon label. */
export function containerIconURL(
	container: { iconLightUrl?: string; iconDarkUrl?: string; labels: Record<string, string> },
	isDark: boolean
): string | undefined {
	const legacy =
		container.labels['com.getarcaneapp.arcane.icon'] ?? container.labels['arcane.icon'];
	const themed = isDark
		? (container.iconDarkUrl ?? container.iconLightUrl)
		: (container.iconLightUrl ?? container.iconDarkUrl);
	return themed || legacy || undefined;
}

/** `ContainerResourceMetrics` texts. */
export const ResourceMetricsText = {
	cpu: (sample: { cpuPercent: number }) => percent1(sample.cpuPercent),
	memoryUsed: (sample: { memoryUsageBytes: number }) => byteString(sample.memoryUsageBytes),
	memoryPercent: (sample: { memoryUsageBytes: number; memoryLimitBytes: number }) =>
		sample.memoryLimitBytes > 0
			? Math.min(Math.max((sample.memoryUsageBytes / sample.memoryLimitBytes) * 100, 0), 100)
			: 0,
	accessibility: (sample: {
		cpuPercent: number;
		memoryUsageBytes: number;
		memoryLimitBytes: number;
	}) => {
		let memory = byteString(sample.memoryUsageBytes);
		if (sample.memoryLimitBytes > 0) memory += ` of ${byteString(sample.memoryLimitBytes)}`;
		return `CPU ${percent1(sample.cpuPercent)}, memory ${memory}`;
	}
} as const;
