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
	SystemStatsDisplay,
	type AggregateCounts,
	type AttentionSummary,
	type DashboardEnvironmentState,
	type SparklineSample
} from '@/stores/dashboard-stream-logic';

export const byteString = formatFileBytes;

export const percent0 = (value: number) => `${value.toFixed(0)}%`;
export const percent1 = (value: number) => `${value.toFixed(1)}%`;

export function displayName(environment: Pick<Environment, 'id' | 'name'>): string {
	return environment.name ? environment.name : `Environment ${environment.id}`;
}

export const nameOrID = (environment: Pick<Environment, 'id' | 'name'>) =>
	environment.name ?? environment.id;

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

const shownGreetings = new Map<string, string>();
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

export type DashboardLiveCounts = {
	running: number;
	stopped: number;
	total: number;
	images: number;
};

export type DashboardEnvironmentLiveStates = Readonly<Record<string, DockerInfo | null>>;

export function liveStatesFrom(
	enabledEnvironments: readonly Pick<Environment, 'id'>[],
	dockerInfo: Readonly<Record<string, DockerInfo>>
): DashboardEnvironmentLiveStates {
	return Object.fromEntries(enabledEnvironments.map((e) => [e.id, dockerInfo[e.id] ?? null]));
}

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

export function overviewCounts(
	aggregate: AggregateCounts | undefined,
	liveCounts: DashboardLiveCounts | undefined
): DashboardLiveCounts | undefined {
	if (!aggregate) return liveCounts;
	return {
		running: aggregate.runningContainers,
		stopped: aggregate.stoppedContainers,
		total: aggregate.totalContainers,
		images: aggregate.totalImages
	};
}

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
export const reappearRefreshIntervalMs = 60_000;

export function resolveImageUpdateCount(
	shared?: number,
	streamed?: number,
	supplemental?: number
): number | undefined {
	return shared ?? supplemental ?? streamed;
}

export function liveStatsLimitMessage(
	enabledEnvironmentCount: number,
	maximumStreams: number
): string | undefined {
	if (maximumStreams <= 0 || enabledEnvironmentCount <= maximumStreams) return undefined;
	return `Live CPU, memory, and disk metrics stream for the first ${maximumStreams} enabled environments. Change this in App Settings. Container and image counts still load for every environment.`;
}

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

export function showsAllEnvironmentsCountNote(
	allEnvironmentsPreview: boolean,
	enabledEnvironmentCount: number
): boolean {
	return !allEnvironmentsPreview && enabledEnvironmentCount > 1;
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

export type AttentionSeverity = 'critical' | 'warning';

export const severityTitle: Record<AttentionSeverity, string> = {
	critical: 'Critical',
	warning: 'Warnings'
};

export type AttentionAction =
	| { kind: 'environment'; id: string; name: string }
	| { kind: 'vulnerabilities'; id: string; name: string }
	| { kind: 'stoppedContainers' }
	| { kind: 'imageUpdates' }
	| { kind: 'apiKeys' }
	| { kind: 'failedActivities' };

export type NeedsAttentionItem = {
	id: string;
	detail: string;
	severity: AttentionSeverity;
	icon: string;
	title: string;
	count: number;
	action: AttentionAction;
	presentsSheet: boolean;
};

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
			action: { kind: 'stoppedContainers' },
			presentsSheet: false
		});
	}
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
			action: { kind: 'failedActivities' },
			presentsSheet: true
		});
	}
	return items;
}

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

export function sourceEnvironmentKey(activity: Activity): string {
	const source = activity.sourceEnvironmentID?.trim() ?? '';
	if (source) return source;
	const environment = activity.environmentID.trim();
	return environment ? environment : '0';
}

export function activitySortTime(activity: Activity): number {
	const raw = activity.updatedAt ?? activity.endedAt ?? activity.startedAt;
	return parseArcaneDate(raw)?.getTime() ?? 0;
}

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

export type AllEnvironmentsCounts = {
	running?: number;
	total?: number;
	images?: number;
	volumes?: number;
	updates?: number;
	vulnerabilities?: number;
};

export type UsageMetric = 'CPU' | 'Memory';

export const usageWindowSeconds = 300;

export function windowEnd(newest: number, stepSeconds = 2): number {
	const step = stepSeconds * 1000;
	return Math.floor(newest / step) * step;
}

export function smoothed(samples: readonly SparklineSample[], weight = 0.35): SparklineSample[] {
	let average: number | undefined;
	return samples.map((sample) => {
		const next = average === undefined ? sample.value : average + weight * (sample.value - average);
		average = next;
		return { timestamp: sample.timestamp, value: next };
	});
}

const smoothedCache = new WeakMap<readonly SparklineSample[], SparklineSample[]>();

export function smoothedSeries(samples: readonly SparklineSample[]): SparklineSample[] {
	const cached = smoothedCache.get(samples);
	if (cached) return cached;
	const next = smoothed(samples);
	smoothedCache.set(samples, next);
	return next;
}

export function usageHeadline(
	metric: UsageMetric,
	stats: readonly SystemStats[]
): { value: string; detail: string } | undefined {
	if (stats.length === 0) return undefined;
	const hosts = stats.length === 1 ? '1 environment' : `${stats.length} environments`;
	if (metric === 'CPU') {
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

export function arcaneVersionBadge(
	info: Pick<VersionInfo, 'displayVersion' | 'currentTag' | 'currentVersion'>
): string {
	const raw = info.displayVersion || info.currentTag || info.currentVersion;
	if (!raw) return '—';
	return raw.startsWith('v') ? raw : `v${raw}`;
}

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

export function containerDisplayName(container: { names: string[]; id: string }): string {
	const first = (container.names[0] ?? '').replace(/^\/+|\/+$/g, '');
	return first ? first : container.id.slice(0, 12);
}

export const containerIsRunning = (container: { state: string }) =>
	container.state.toLowerCase() === 'running';

export const projectIsRunning = (project: { status: string }) =>
	project.status.toLowerCase() === 'running';

export const capitalized = (value: string) =>
	value
		.toLowerCase()
		.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());

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

export function containerStatusText(status: string): string {
	let text = status;
	for (const token of ['(healthy)', '(unhealthy)', '(health: starting)']) {
		text = text.replace(new RegExp(token.replace(/[()]/g, '\\$&'), 'gi'), '');
	}
	return text.trim();
}

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
