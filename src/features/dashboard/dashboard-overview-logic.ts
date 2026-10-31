import { formatFileBytes } from '@/core/networking/remote-data-limits';
import { relativeTimeFormat } from '@/core/relative-time';
import type { Activity } from '@/sdk/models/activity/Activity';
import { arcaneTimestampMs } from '@/sdk/models/base/date';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { Event } from '@/sdk/models/event/Event';
import type { JobRunStatus, JobStatus } from '@/sdk/models/jobSchedule/JobSchedule';
import { SystemDiskUsage } from '@/sdk/models/system/SystemDiskUsage';
import type { VersionInfo } from '@/sdk/models/version/VersionInfo';
import type { JSONValue } from '@/sdk/types/json';
import type { VulnerabilityRiskFinding } from '@/sdk/types/VulnerabilityRiskOverview';
import { environmentIsOnline } from '@/stores/dashboard-stream-logic';

export type OverviewAttentionSeverity = 'critical' | 'warning' | 'info';
export type OverviewAttentionSort = 'impact' | 'newest';

export type OverviewAttentionAction =
	| { kind: 'environment'; environmentID: string }
	| { kind: 'containers'; environmentID: string }
	| { kind: 'containerLogs'; environmentID: string; containerID: string }
	| { kind: 'vulnerabilities'; environmentID: string }
	| { kind: 'jobs'; environmentID: string }
	| { kind: 'failedActivities' }
	| { kind: 'apiKeys' }
	| { kind: 'upgrade'; environmentID: string };

export type OverviewAttentionItem = {
	key: string;
	severity: OverviewAttentionSeverity;
	environmentID: string;
	title: string;
	detail: string;
	timestamp: number | undefined;
	actionLabel: string;
	action: OverviewAttentionAction;
	count?: number;
};

export type CollapsedActivity = { key: string; activity: Activity; ids: string[] };
export type EnvironmentJob = { environmentID: string; job: JobStatus };
export type EnvironmentEvent = { environmentID: string; event: Event };
export type EnvironmentFinding = { environmentID: string; finding: VulnerabilityRiskFinding };
export type DiskStats = { percent: number; used: number; total: number };

export type OverviewAttentionSources = {
	environments: readonly Pick<Environment, 'id' | 'name' | 'status' | 'lastSeen'>[];
	unhealthy: Readonly<Record<string, number>>;
	events: readonly EnvironmentEvent[];
	findings: readonly EnvironmentFinding[];
	disk: Readonly<Record<string, DiskStats>>;
	jobs: readonly EnvironmentJob[];
	activityGroups: readonly CollapsedActivity[];
	expiringKeys: number;
	keysEnvironmentID: string;
	versions: Readonly<Record<string, VersionInfo>>;
	upgradable: ReadonlySet<string>;
	now: number;
};

const hourMs = 60 * 60 * 1000;
const severityRank: Record<OverviewAttentionSeverity, number> = {
	critical: 0,
	warning: 1,
	info: 2
};
const containerEventWindowMs = hourMs;
const diskWarningPercent = 85;
const diskCriticalPercent = 95;
const repeatedFailureThreshold = 3;
const repeatedFailureWindowMs = 24 * hourMs;
const failedRunStatuses: ReadonlySet<JobRunStatus> = new Set([
	'failed',
	'partial',
	'needs_attention'
]);
const deployActivityTypes: ReadonlySet<string> = new Set([
	'project_deploy',
	'project_redeploy',
	'container_redeploy'
]);
const userJobGroups: ReadonlySet<string> = new Set([
	'auto-update',
	'image-polling',
	'vulnerability-scan',
	'scheduled-prune',
	'volume-backup',
	'system-backup',
	'gitops-sync',
	'auto-heal',
	'auto-patch'
]);

export const overviewListLimit = 5;

function displayName(raw: string): string {
	return raw
		.split(/[_\s]+/)
		.filter((part) => part !== '')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(' ');
}

export function relativeTime(ms: number, now = Date.now()): string {
	const seconds = Math.round((ms - now) / 1000);
	const format = relativeTimeFormat();
	const abs = Math.abs(seconds);
	if (abs < 60) return format.format(seconds, 'second');
	if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
	if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour');
	return format.format(Math.round(seconds / 86400), 'day');
}

export function activityEnvironmentID(activity: Activity): string {
	return activity.sourceEnvironmentID?.trim() || activity.environmentID;
}

export function activityTitle(activity: Activity): string {
	return displayName(activity.type);
}

export function activityTime(activity: Activity): number | undefined {
	return arcaneTimestampMs(activity.endedAt || activity.startedAt);
}

export function isDeployActivity(activity: Activity): boolean {
	return deployActivityTypes.has(activity.type);
}

export function collapseActivities(activities: readonly Activity[]): CollapsedActivity[] {
	const groups = new Map<string, CollapsedActivity>();
	for (const activity of activities) {
		const key = [
			activity.type,
			activity.resourceType ?? '',
			activity.resourceID || activity.resourceName || '',
			activity.status,
			activityEnvironmentID(activity)
		].join('|');
		const existing = groups.get(key);
		groups.set(
			key,
			existing
				? { ...existing, ids: [...existing.ids, activity.id] }
				: { key, activity, ids: [activity.id] }
		);
	}
	return [...groups.values()];
}

export type ActivityFilter = 'all' | 'deploys' | 'failures';

export function filterActivityGroups(
	groups: readonly CollapsedActivity[],
	filter: ActivityFilter
): CollapsedActivity[] {
	return groups
		.filter(({ activity }) => {
			if (filter === 'deploys') return isDeployActivity(activity);
			if (filter === 'failures') return activity.status === 'failed';
			return true;
		})
		.slice(0, overviewListLimit);
}

export function jobLabel(job: Pick<JobStatus, 'id' | 'name'>): string {
	const [group = '', ...target] = job.id.split(':');
	const labels: Record<string, string> = {
		'gitops-sync': 'GitOps',
		'volume-backup': 'Volume Backup',
		'system-backup': 'System Backup'
	};
	if (group === 'environment-health' && target.length > 0) return 'Health Check';
	const label = labels[group];
	if (!label) return job.name;
	return target.length > 0 ? `${label}: ${target.join(':')}` : label;
}

export function flattenJobs(environmentID: string, jobs: readonly JobStatus[]): EnvironmentJob[] {
	return jobs
		.flatMap((job) => [job, ...(job.children ?? [])])
		.map((job) => ({ environmentID, job }));
}

export type UpcomingJob = EnvironmentJob & { nextRun: number };

export function upcomingJobs(jobs: readonly EnvironmentJob[], now: number): UpcomingJob[] {
	return jobs
		.flatMap((entry) => {
			const [group = ''] = entry.job.id.split(':');
			const nextRun = arcaneTimestampMs(entry.job.nextRun);
			return userJobGroups.has(group) && entry.job.enabled && nextRun !== undefined && nextRun > now
				? [{ ...entry, nextRun }]
				: [];
		})
		.sort((a, b) => a.nextRun - b.nextRun)
		.slice(0, overviewListLimit);
}

export type EnvironmentDiskUsage = { environmentID: string; usage: SystemDiskUsage };

export type ReclaimableResource = {
	key: 'images' | 'buildCache' | 'volumes' | 'containers';
	title: string;
	total: number;
	segments: { environmentID: string; bytes: number }[];
};

const reclaimableTypes: {
	key: ReclaimableResource['key'];
	title: string;
	bytes: (usage: SystemDiskUsage) => number;
}[] = [
	{ key: 'images', title: 'Unused Images', bytes: (usage) => usage.unusedImagesBytes },
	{ key: 'buildCache', title: 'Build Cache', bytes: (usage) => usage.buildCacheBytes },
	{ key: 'volumes', title: 'Unused Volumes', bytes: (usage) => usage.unusedVolumesBytes },
	{
		key: 'containers',
		title: 'Stopped Containers',
		bytes: (usage) => usage.stoppedContainersBytes
	}
];

export function reclaimableResources(
	usage: readonly EnvironmentDiskUsage[]
): ReclaimableResource[] {
	return reclaimableTypes
		.map((type) => {
			const segments = usage
				.map((entry) => ({ environmentID: entry.environmentID, bytes: type.bytes(entry.usage) }))
				.filter((segment) => segment.bytes > 0);
			return {
				key: type.key,
				title: type.title,
				total: segments.reduce((sum, segment) => sum + segment.bytes, 0),
				segments
			};
		})
		.filter((resource) => resource.total > 0);
}

export function reclaimableByEnvironment(
	usage: readonly EnvironmentDiskUsage[],
	limit = 3
): { environmentID: string; bytes: number }[] {
	return usage
		.map((entry) => ({
			environmentID: entry.environmentID,
			bytes: SystemDiskUsage.totalBytes(entry.usage)
		}))
		.filter((entry) => entry.bytes > 0)
		.sort((a, b) => b.bytes - a.bytes)
		.slice(0, limit);
}

export function totalReclaimable(usage: readonly EnvironmentDiskUsage[]): number {
	return usage.reduce((sum, entry) => sum + SystemDiskUsage.totalBytes(entry.usage), 0);
}

function metadataText(value: JSONValue | undefined): string {
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
		? String(value)
		: '';
}

function containerEventItems(
	events: readonly EnvironmentEvent[],
	now: number
): OverviewAttentionItem[] {
	const cutoff = now - containerEventWindowMs;
	const latest = new Map<string, { entry: EnvironmentEvent; at: number }>();
	for (const entry of events) {
		const { event } = entry;
		const at = arcaneTimestampMs(event.timestamp);
		const exitCode = metadataText(event.metadata?.['exitCode']) || '0';
		const abnormal =
			event.type === 'container.oom' || (event.type === 'container.die' && exitCode !== '0');
		if (at === undefined || at < cutoff || !abnormal || !event.resourceId) continue;
		const key = `${entry.environmentID}:${event.resourceId}`;
		const existing = latest.get(key);
		if (!existing || existing.at < at) latest.set(key, { entry, at });
	}
	return [...latest.entries()].map(([key, { entry, at }]) => {
		const { event, environmentID } = entry;
		const name = event.resourceName || metadataText(event.metadata?.['name']) || event.resourceId;
		const oom = event.type === 'container.oom';
		return {
			key: `event:${key}`,
			severity: oom ? 'critical' : 'warning',
			environmentID,
			title: oom
				? `${name} ran out of memory`
				: `${name} exited with code ${metadataText(event.metadata?.['exitCode'])}`,
			detail: relativeTime(at, now),
			timestamp: at,
			actionLabel: 'Logs',
			action: { kind: 'containerLogs', environmentID, containerID: event.resourceId ?? '' }
		};
	});
}

function failedJobItems(sources: OverviewAttentionSources): OverviewAttentionItem[] {
	const cutoff = sources.now - repeatedFailureWindowMs;
	const failedGroups = sources.activityGroups.filter(
		({ activity }) => activity.status === 'failed'
	);
	const failedJobs = sources.jobs
		.filter(({ job }) => job.lastRun !== undefined && failedRunStatuses.has(job.lastRun.status))
		.map((entry) => {
			const run = entry.job.lastRun;
			const runActivityIDs = new Set(
				[
					run?.activityId,
					run?.outcome?.activityId,
					...(run?.outcome?.targets ?? []).map((target) => target.activityId)
				].filter((id): id is string => id !== undefined)
			);
			return {
				...entry,
				group: failedGroups.find((group) => group.ids.some((id) => runActivityIDs.has(id)))
			};
		});
	const jobGroupKeys = new Set(failedJobs.flatMap(({ group }) => (group ? [group.key] : [])));

	return [
		...failedJobs.map(({ environmentID, job, group }): OverviewAttentionItem => ({
			key: `job:${environmentID}:${job.id}`,
			severity: 'warning',
			environmentID,
			title: `${group ? activityTitle(group.activity) : jobLabel(job)} failed`,
			detail: job.lastError || job.lastRun?.outcome?.message || '',
			timestamp: arcaneTimestampMs(job.lastRun?.finishedAt ?? job.lastRun?.updatedAt),
			actionLabel: 'View',
			action: { kind: 'jobs', environmentID },
			count: group?.ids.length
		})),
		...failedGroups
			.filter((group) => {
				const failedAt = activityTime(group.activity);
				return (
					!jobGroupKeys.has(group.key) &&
					group.ids.length >= repeatedFailureThreshold &&
					failedAt !== undefined &&
					failedAt >= cutoff
				);
			})
			.map(({ key, activity, ids }): OverviewAttentionItem => {
				const environmentID = activityEnvironmentID(activity);
				const title = activityTitle(activity);
				const timestamp = activityTime(activity);
				return {
					key: `failing:${key}`,
					severity: 'warning',
					environmentID,
					title: `${activity.resourceName ? `${title} ${activity.resourceName}` : title} failed`,
					detail:
						activity.error || (timestamp !== undefined ? relativeTime(timestamp, sources.now) : ''),
					timestamp,
					actionLabel: 'View',
					action: { kind: 'failedActivities' },
					count: ids.length
				};
			})
	];
}

export function buildOverviewAttentionItems(
	sources: OverviewAttentionSources
): OverviewAttentionItem[] {
	const offline = sources.environments.filter((e) => !environmentIsOnline(e));
	const online = sources.environments.filter(environmentIsOnline);

	return [
		...offline.map((environment): OverviewAttentionItem => {
			const lastSeen = arcaneTimestampMs(environment.lastSeen);
			return {
				key: `offline:${environment.id}`,
				severity: 'critical',
				environmentID: environment.id,
				title: `${environment.name || environment.id} is offline`,
				detail:
					lastSeen !== undefined
						? `Last seen ${relativeTime(lastSeen, sources.now)}`
						: displayName(environment.status),
				timestamp: lastSeen,
				actionLabel: 'View',
				action: { kind: 'environment', environmentID: environment.id }
			};
		}),
		...online.flatMap((environment): OverviewAttentionItem[] => {
			const unhealthy = sources.unhealthy[environment.id] ?? 0;
			return unhealthy > 0
				? [
						{
							key: `unhealthy:${environment.id}`,
							severity: 'critical',
							environmentID: environment.id,
							title: `${unhealthy} unhealthy container${unhealthy === 1 ? '' : 's'}`,
							detail: 'Unhealthy',
							timestamp: undefined,
							actionLabel: 'View',
							action: { kind: 'containers', environmentID: environment.id }
						}
					]
				: [];
		}),
		...containerEventItems(sources.events, sources.now),
		...sources.findings
			.filter(({ finding }) => finding.knownExploited && (finding.runningImagesAffected ?? 0) > 0)
			.map(({ environmentID, finding }): OverviewAttentionItem => ({
				key: `kev:${environmentID}:${finding.vulnerabilityId}`,
				severity: 'critical',
				environmentID,
				title: `${finding.vulnerabilityId} is known exploited and running`,
				detail: `${finding.pkgName} → ${finding.fixedVersion || 'No fix'}`,
				timestamp: undefined,
				actionLabel: 'View',
				action: { kind: 'vulnerabilities', environmentID }
			})),
		...online.flatMap((environment): OverviewAttentionItem[] => {
			const disk = sources.disk[environment.id];
			if (!disk || disk.percent < diskWarningPercent) return [];
			return [
				{
					key: `disk:${environment.id}`,
					severity: disk.percent >= diskCriticalPercent ? 'critical' : 'warning',
					environmentID: environment.id,
					title: `Disk ${Math.round(disk.percent)}% full`,
					detail: `${formatFileBytes(disk.used)} / ${formatFileBytes(disk.total)}`,
					timestamp: undefined,
					actionLabel: 'View',
					action: { kind: 'environment', environmentID: environment.id }
				}
			];
		}),
		...failedJobItems(sources),
		...(sources.expiringKeys > 0
			? [
					{
						key: 'apikeys',
						severity: 'warning',
						environmentID: sources.keysEnvironmentID,
						title: `${sources.expiringKeys} API key${sources.expiringKeys === 1 ? '' : 's'} expiring soon`,
						detail: '',
						timestamp: undefined,
						actionLabel: 'Manage',
						action: { kind: 'apiKeys' }
					} satisfies OverviewAttentionItem
				]
			: []),
		...online.flatMap((environment): OverviewAttentionItem[] => {
			const version = sources.versions[environment.id];
			if (!version?.updateAvailable) return [];
			const upgradable = sources.upgradable.has(environment.id);
			const newest = version.newestVersion || version.newestDigest?.slice(0, 12) || '';
			return [
				{
					key: `version:${environment.id}`,
					severity: 'info',
					environmentID: environment.id,
					title: newest ? `Update available: ${newest}` : 'Update available',
					detail: version.displayVersion || version.currentTag || version.currentVersion,
					timestamp: arcaneTimestampMs(version.releasedAt),
					actionLabel: upgradable ? 'Upgrade' : 'View',
					action: upgradable
						? { kind: 'upgrade', environmentID: environment.id }
						: { kind: 'environment', environmentID: environment.id }
				}
			];
		})
	];
}

export function sortOverviewAttention(
	items: readonly OverviewAttentionItem[],
	sort: OverviewAttentionSort
): OverviewAttentionItem[] {
	const time = (item: OverviewAttentionItem) => item.timestamp ?? 0;
	const rank = (item: OverviewAttentionItem) => severityRank[item.severity];
	return [...items].sort((a, b) =>
		sort === 'impact'
			? rank(a) - rank(b) || time(b) - time(a)
			: time(b) - time(a) || rank(a) - rank(b)
	);
}
