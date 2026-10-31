import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import type { DashboardSnapshot } from '@/sdk/models/dashboard';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import type { SystemStats } from '@/sdk/models/system/SystemStats';
import { deepEqual } from '@/core/deep-equal';
import { pruneRankings, topBusiest } from '@/stores/busiest-containers-logic';
import { coalescedUpdates } from '@/stores/coalesced-updates';
import {
	appendFrame,
	applyError,
	applySnapshot,
	clearAllStreamErrors,
	emptySeries,
	invalidateSnapshots,
	nextReconnect,
	reconcileStates,
	resolvedAggregate,
	resolvedAttention,
	statsWindowSize
} from '@/stores/dashboard-stream-logic';
import {
	aggregateLiveCounts,
	countAvailabilityIssues,
	dashboardEnvironments,
	environmentSummary,
	formatPruneResult,
	mergeFailedActivities,
	needsAttentionItems,
	resolveImageUpdateCount,
	retainingActiveActivities,
	smoothed,
	smoothedSeries,
	usageHeadline,
	windowEnd
} from '@/features/dashboard/dashboard-logic';
import {
	buildOverviewAttentionItems,
	collapseActivities,
	filterActivityGroups,
	jobLabel,
	reclaimableByEnvironment,
	reclaimableResources,
	sortOverviewAttention,
	upcomingJobs,
	type OverviewAttentionSources
} from '@/features/dashboard/dashboard-overview-logic';
import {
	DashboardWidget,
	groupVisibleWidgets,
	layoutFromServer,
	moveWidgetEntries,
	resolveDashboardLayout,
	setWidgetHidden,
	availableWidgets
} from '@/features/dashboard/dashboard-widgets';
import type { Activity } from '@/sdk/models/activity/Activity';
import type { JobStatus } from '@/sdk/models/jobSchedule/JobSchedule';

const env = (
	id: string,
	extra: Partial<{ name: string; enabled: boolean; status: string }> = {}
) => ({
	id,
	name: extra.name ?? `Env ${id}`,
	enabled: extra.enabled ?? true,
	status: extra.status ?? 'online'
});

function snapshot(args: {
	running?: number;
	stopped?: number;
	images?: number;
	items?: { kind: string; count: number; severity?: string }[];
	update?: boolean;
}): DashboardSnapshot {
	const running = args.running ?? 0;
	const stopped = args.stopped ?? 0;
	return {
		containers: {
			data: [],
			counts: {
				runningContainers: running,
				stoppedContainers: stopped,
				totalContainers: running + stopped
			},
			pagination: {} as never
		},
		images: { data: [], pagination: {} as never },
		imageUsageCounts: { totalImages: args.images ?? 0 } as never,
		actionItems: {
			items: (args.items ?? []).map((i) => ({
				kind: i.kind,
				count: i.count,
				severity: i.severity ?? 'warning'
			}))
		},
		settings: {},
		versionInfo: args.update === undefined ? undefined : ({ updateAvailable: args.update } as never)
	};
}

const docker = (running: number, total: number, images: number) =>
	({
		info: {
			ContainersRunning: running,
			Containers: total,
			ContainersStopped: total - running,
			Images: images
		}
	}) as unknown as DockerInfo;

describe('dashboard stream reducers', () => {
	it('tracks enabled environments only and reports additions', () => {
		const { states, added } = reconcileStates({}, [
			env('0'),
			env('1', { enabled: false }),
			env('2', { name: '  ' })
		]);
		assert.deepEqual(Object.keys(states).sort(), ['0', '2']);
		assert.deepEqual(added.sort(), ['0', '2']);
		assert.equal(states['2']?.name, '2');
		assert.equal(reconcileStates(states, [env('0')]).added.length, 0);
	});

	it('aggregates only when every environment has a snapshot', () => {
		let { states } = reconcileStates({}, [env('0'), env('1')]);
		states = applySnapshot(
			states,
			'0',
			snapshot({ running: 2, stopped: 1, images: 4, items: [{ kind: 'image_updates', count: 3 }] })
		);
		assert.equal(resolvedAggregate(states), undefined);
		states = applySnapshot(states, '1', snapshot({ running: 1, images: 1 }));
		assert.deepEqual(resolvedAggregate(states), {
			runningContainers: 3,
			stoppedContainers: 1,
			totalContainers: 4,
			totalImages: 5,
			imageUpdates: 3
		});
		assert.equal(resolvedAggregate(applyError(states, '1', 'boom', 'unreachable')), undefined);
		assert.equal(resolvedAggregate(invalidateSnapshots(states)), undefined);
	});

	it('ignores events for untracked environments', () => {
		const { states } = reconcileStates({}, [env('0')]);
		assert.equal(applySnapshot(states, '9', snapshot({})), states);
		assert.equal(applyError(states, '9', 'x', undefined), states);
	});

	it('folds attention across environments', () => {
		let { states } = reconcileStates({}, [env('a'), env('b'), env('c')]);
		states = applySnapshot(
			states,
			'a',
			snapshot({
				items: [
					{ kind: 'actionable_vulnerabilities', count: 2 },
					{ kind: 'stopped_containers', count: 1 }
				],
				update: true
			})
		);
		states = applySnapshot(
			states,
			'b',
			snapshot({
				items: [
					{ kind: 'actionable_vulnerabilities', count: 5, severity: 'critical' },
					{ kind: 'expiring_keys', count: 1 }
				],
				update: false
			})
		);
		states = applyError(states, 'c', 'down', undefined);
		const attention = resolvedAttention(states);
		assert.equal(attention.vulnerabilities, 7);
		assert.equal(attention.mostVulnerableEnvironmentID, 'b');
		assert.equal(attention.hasCriticalVulnerabilities, true);
		assert.equal(attention.stoppedContainers, 1);
		assert.equal(attention.expiringKeys, 1);
		assert.equal(attention.arcaneUpgradeCount, 1);
		assert.deepEqual([...attention.erroringEnvironmentIDs], ['c']);
		assert.equal(resolvedAttention(clearAllStreamErrors(states)).erroringEnvironmentIDs.size, 0);
		assert.equal(resolvedAttention({}).arcaneUpgradeCount, undefined);
	});

	it('backs off exponentially, then idles', () => {
		assert.deepEqual(nextReconnect(0), { delay: 1, attempt: 1, exhausted: false });
		assert.equal(nextReconnect(4).delay, 15);
		assert.deepEqual(nextReconnect(20), { delay: 30, attempt: 20, exhausted: true });
	});
});

describe('stats history', () => {
	const frame = (cpu: number, used = 50, total = 100): SystemStats =>
		({ cpuUsage: cpu, memoryUsage: used, memoryTotal: total, cpuCount: 2 }) as SystemStats;

	it('clamps samples and keeps a rolling window', () => {
		let series = emptySeries;
		for (let i = 0; i < statsWindowSize + 5; i++)
			series = appendFrame(series, frame(i === 0 ? 140 : 10), i);
		assert.equal(series.cpu.length, statsWindowSize);
		assert.equal(series.cpu[0]?.timestamp, 5);
		assert.equal(appendFrame(emptySeries, frame(140), 0).cpu[0]?.value, 100);
		assert.equal(appendFrame(emptySeries, frame(10, 0, 0), 0).memory.length, 0);
	});

	it('computes the usage headline weighted by cores', () => {
		const stats = [
			{ ...frame(100), cpuCount: 1 },
			{ ...frame(0), cpuCount: 3 }
		] as SystemStats[];
		assert.deepEqual(usageHeadline('CPU', stats), {
			value: '25.0%',
			detail: '2 environments · 4 cores'
		});
		assert.equal(usageHeadline('Memory', [frame(0, 1, 4)])?.value, '25%');
		assert.equal(usageHeadline('CPU', []), undefined);
	});

	it('smooths and snaps the chart window', () => {
		assert.deepEqual(
			smoothed([
				{ timestamp: 0, value: 0 },
				{ timestamp: 1, value: 100 }
			]).map((s) => s.value),
			[0, 35]
		);
		assert.equal(windowEnd(5_999), 4_000);
	});
});

describe('dashboard view logic', () => {
	it('puts the active environment first and caps the batch', () => {
		assert.deepEqual(
			dashboardEnvironments([env('a'), env('b'), env('c')], 'c', 2).map((e) => e.id),
			['c', 'a']
		);
	});

	it('requires every enabled environment online for live counts', () => {
		assert.deepEqual(aggregateLiveCounts({ a: docker(1, 2, 3), b: docker(2, 2, 1) }, 2), {
			running: 3,
			stopped: 1,
			total: 4,
			images: 4
		});
		assert.equal(aggregateLiveCounts({ a: docker(1, 2, 3), b: null }, 2), undefined);
		assert.equal(aggregateLiveCounts({ a: docker(1, 2, 3) }, 2), undefined);
	});

	it('prefers summary update counts over the stream', () => {
		assert.equal(resolveImageUpdateCount(undefined, 9, 4), 4);
		assert.equal(resolveImageUpdateCount(2, 9, 4), 2);
		assert.equal(resolveImageUpdateCount(undefined, 9, undefined), 9);
	});

	it('summarises unavailable environments', () => {
		const all = [env('a', { name: 'Alpha' }), env('b', { name: 'Beta' }), env('c'), env('d')];
		assert.equal(environmentSummary(['a'], all), 'Alpha');
		assert.equal(environmentSummary(['a', 'b'], all), 'Alpha and Beta');
		assert.equal(environmentSummary(['a', 'b', 'c', 'd'], all), 'Alpha and Beta and 2 more');
		const issues = countAvailabilityIssues({
			hasLoadedEnvironmentCounts: true,
			allEnvironments: all.slice(0, 2),
			liveStates: { a: docker(1, 1, 1), b: null },
			liveCounts: undefined,
			volumeCountUnavailableEnvironmentIDs: ['b'],
			updateCountUnavailableEnvironmentIDs: ['a'],
			hasStreamAggregate: true
		});
		assert.deepEqual(
			issues.map((i) => i.id),
			['docker', 'volumes']
		);
	});

	it('builds attention items in severity order', () => {
		const items = needsAttentionItems({
			attention: {
				erroringEnvironmentIDs: new Set(['b']),
				stoppedContainers: 2,
				imageUpdates: 1,
				expiringKeys: 0,
				vulnerabilities: 3,
				mostVulnerableEnvironmentID: 'a',
				hasCriticalVulnerabilities: false
			},
			allEnvironments: [env('a', { name: 'Alpha' }), env('b', { name: 'Beta' })],
			allEnvironmentsPreview: false,
			imageUpdatesTotal: 6,
			failedActivityCount: 1
		});
		assert.deepEqual(
			items.map((i) => i.id),
			[
				'offline-environments',
				'vulnerabilities',
				'stopped-containers',
				'image-updates',
				'failed-activities'
			]
		);
		assert.equal(items[0]?.title, 'Beta unreachable');
		assert.equal(items.find((i) => i.id === 'image-updates')?.count, 6);
	});

	it('keeps the newest three failed activities and filters cleared ones', () => {
		const activity = (id: string, updatedAt: string, extra: Record<string, unknown> = {}) =>
			({
				id,
				environmentID: '0',
				status: 'failed',
				startedAt: updatedAt,
				updatedAt,
				...extra
			}) as never;
		const merged = mergeFailedActivities([
			{
				id: '1',
				name: 'One',
				activities: [activity('a', '2026-01-01T00:00:00Z'), activity('b', '2026-01-04T00:00:00Z')]
			},
			{
				id: '2',
				name: 'Two',
				activities: [activity('c', '2026-01-03T00:00:00Z'), activity('d', '2026-01-02T00:00:00Z')]
			}
		]);
		assert.deepEqual(
			merged.map((a) => (a as { id: string }).id),
			['b', 'c', 'd']
		);
		assert.equal((merged[1] as { sourceEnvironmentID?: string }).sourceEnvironmentID, '2');
		assert.equal(retainingActiveActivities(merged, new Set(['2'])).length, 1);
	});

	it('formats prune results', () => {
		assert.equal(formatPruneResult({ spaceReclaimed: 0 } as never), 'Nothing to remove.');
		assert.equal(
			formatPruneResult({
				containersPruned: ['a'],
				imagesDeleted: ['x', 'y'],
				spaceReclaimed: 1_500_000,
				errors: ['e1']
			} as never),
			'Removed 1 container, 2 images. Freed 1.5 MB.\nErrors: e1'
		);
	});
});

describe('busiest containers', () => {
	const container = (id: string, cpu: number, memory: number) =>
		({
			id,
			names: [id],
			resourceSample: { cpuPercent: cpu, memoryUsageBytes: memory, memoryLimitBytes: 0 }
		}) as unknown as ContainerSummary;

	it('ranks across environments by the chosen sort', () => {
		const rankings = {
			cpuUsage: { a: [container('x', 5, 1), container('y', 50, 1)], b: [container('z', 20, 1)] },
			memoryUsage: { a: [container('x', 5, 900)], b: [container('z', 20, 100)] }
		};
		assert.deepEqual(
			topBusiest(rankings, 'cpuUsage', 2, ['a', 'b']).map((e) => e.id),
			['a/y', 'b/z']
		);
		assert.deepEqual(
			topBusiest(rankings, 'memoryUsage', 5, ['b']).map((e) => e.id),
			['b/z']
		);
		assert.deepEqual(Object.keys(pruneRankings(rankings, new Set(['b'])).cpuUsage ?? {}), ['b']);
	});
});

describe('busiest containers change detection', () => {
	const container = (id: string, cpu: number) =>
		({
			id,
			names: [id],
			resourceSample: { cpuPercent: cpu, memoryUsageBytes: 1, memoryLimitBytes: 0 }
		}) as unknown as ContainerSummary;

	it('keeps the rankings object when nothing is pruned', () => {
		const rankings = { cpuUsage: { a: [container('x', 5)] } };
		assert.equal(pruneRankings(rankings, new Set(['a', 'b'])), rankings);
		assert.notEqual(pruneRankings(rankings, new Set(['b'])), rankings);
	});

	it('treats identical responses as unchanged', () => {
		assert.ok(deepEqual([container('x', 5)], [container('x', 5)]));
		assert.ok(!deepEqual([container('x', 5)], [container('x', 6)]));
		assert.ok(deepEqual({ a: 1, b: undefined }, { a: 1 }));
		assert.ok(!deepEqual({ a: [1, 2] }, { a: [1, 2, 3] }));
		assert.ok(!deepEqual([], {}));
	});
});

describe('usage smoothing cache', () => {
	it('returns the same smoothed array for the same samples', () => {
		const samples = [
			{ timestamp: 1, value: 10 },
			{ timestamp: 2, value: 30 }
		];
		const first = smoothedSeries(samples);
		assert.equal(smoothedSeries(samples), first);
		assert.deepEqual(first, smoothed(samples));
		assert.notEqual(smoothedSeries([...samples]), first);
	});
});

describe('coalesced stats updates', () => {
	it('commits every queued transform in one batch, in order', async () => {
		const commits: Map<string, number>[] = [];
		const values = new Map<string, number>();
		const updates = coalescedUpdates<number>((pending) => {
			for (const [key, transforms] of pending)
				values.set(
					key,
					transforms.reduce((value, transform) => transform(value), values.get(key) ?? 0)
				);
			commits.push(new Map(values));
		}, 5);
		updates.enqueue('a', (v) => v + 1);
		updates.enqueue('b', (v) => v + 10);
		updates.enqueue('a', (v) => v * 3);
		assert.equal(commits.length, 0);
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(commits.length, 1);
		assert.equal(values.get('a'), 3);
		assert.equal(values.get('b'), 10);
	});

	it('drops keys that are no longer tracked and flushes on demand', () => {
		const committed: string[] = [];
		const updates = coalescedUpdates<number>((pending) => {
			committed.push(...pending.keys());
		}, 1000);
		updates.enqueue('a', (v) => v);
		updates.enqueue('b', (v) => v);
		updates.drop((key) => key === 'b');
		updates.flush();
		assert.deepEqual(committed, ['b']);
		updates.flush();
		assert.deepEqual(committed, ['b']);
	});
});

describe('dashboard widgets', () => {
	const ids = (entries: { id: string; hidden: boolean }[]) =>
		entries.map((entry) => (entry.hidden ? `-${entry.id}` : entry.id));

	it('falls back to defaults with Reclaimable hidden', () => {
		const layout = resolveDashboardLayout({ stored: undefined, server: undefined });
		assert.equal(layout[0]?.id, 'healthy');
		assert.deepEqual(layout.at(-1), { id: 'reclaimableTotal', hidden: true });
		assert.equal(layout.length, DashboardWidget.allCases.length);
	});

	it('orders the web layout by row and column and keeps mobile widgets after environments', () => {
		const layout = layoutFromServer([
			{ id: 'activity', x: 0, y: 9, w: 8, h: 6 },
			{ id: 'environments', x: 0, y: 2, w: 12, h: 4 },
			{ id: 'risk', x: 3, y: 0, w: 3, h: 2 },
			{ id: 'healthy', x: 0, y: 0, w: 3, h: 2 },
			{ id: 'memory', x: 0, y: 0, w: 3, h: 2, hidden: true },
			{ id: 'bogus', x: 0, y: 0, w: 1, h: 1 }
		]);
		assert.ok(layout);
		assert.deepEqual(ids(layout).slice(0, 6), [
			'healthy',
			'attentionCount',
			'updates',
			'risk',
			'environments',
			'usage'
		]);
		assert.equal(ids(layout).indexOf('activity') > ids(layout).indexOf('usage'), true);
		assert.ok(ids(layout).includes('-memory'));
		assert.equal(new Set(layout.map((entry) => entry.id)).size, DashboardWidget.allCases.length);
	});

	it('prefers the stored layout and round-trips it', () => {
		const stored = DashboardWidget.decode(
			DashboardWidget.encode([
				{ id: 'jobs', hidden: false },
				{ id: 'healthy', hidden: true }
			])
		);
		const layout = resolveDashboardLayout({
			stored,
			server: [{ id: 'healthy', x: 0, y: 0, w: 3, h: 2 }]
		});
		assert.equal(layout[0]?.id, 'jobs');
		assert.deepEqual(layout.at(-1), { id: 'healthy', hidden: true });
		assert.ok(layout.some((entry) => entry.id === 'reclaimableTotal' && entry.hidden));
		assert.equal(DashboardWidget.decode('not json'), undefined);
		assert.equal(DashboardWidget.decode('{"order":["nope"]}'), undefined);
	});

	it('groups consecutive stats and moves, hides and shows widgets', () => {
		const entries = [
			{ id: 'healthy' as const, hidden: false },
			{ id: 'updates' as const, hidden: false },
			{ id: 'environments' as const, hidden: false },
			{ id: 'risk' as const, hidden: false },
			{ id: 'jobs' as const, hidden: true }
		];
		assert.deepEqual(
			groupVisibleWidgets(entries).map((group) => group.key),
			['healthy|updates', 'environments', 'risk']
		);
		assert.deepEqual(ids(moveWidgetEntries(entries, [0], 3)), [
			'updates',
			'environments',
			'healthy',
			'risk',
			'-jobs'
		]);
		assert.deepEqual(ids(setWidgetHidden(entries, 'healthy', true)), [
			'updates',
			'environments',
			'risk',
			'-jobs',
			'-healthy'
		]);
		assert.deepEqual(ids(setWidgetHidden(entries, 'jobs', false)), [
			'healthy',
			'updates',
			'environments',
			'risk',
			'jobs'
		]);
		assert.deepEqual(ids(availableWidgets(entries, false)), [
			'healthy',
			'updates',
			'environments',
			'-jobs'
		]);
	});
});

describe('dashboard overview', () => {
	const now = Date.parse('2026-10-30T12:00:00Z');
	const activity = (id: string, extra: Partial<Activity> = {}): Activity => ({
		id,
		environmentID: '0',
		type: 'project_deploy',
		status: 'success',
		resourceID: 'p1',
		resourceName: 'web',
		step: '',
		latestMessage: '',
		startedAt: '2026-10-30T11:30:00Z',
		createdAt: '2026-10-30T11:30:00Z',
		...extra
	});
	const job = (id: string, extra: Partial<JobStatus> = {}): JobStatus => ({
		id,
		name: id,
		description: '',
		category: '',
		schedule: '',
		enabled: true,
		managerOnly: false,
		isContinuous: false,
		canRunManually: true,
		prerequisites: [],
		...extra
	});
	const sources = (extra: Partial<OverviewAttentionSources> = {}): OverviewAttentionSources => ({
		environments: [],
		unhealthy: {},
		events: [],
		findings: [],
		disk: {},
		jobs: [],
		activityGroups: [],
		expiringKeys: 0,
		keysEnvironmentID: '0',
		versions: {},
		upgradable: new Set(),
		now,
		...extra
	});

	it('collapses repeated activities and filters them', () => {
		const groups = collapseActivities([
			activity('a'),
			activity('b'),
			activity('c', { status: 'failed', type: 'container_restart' })
		]);
		assert.equal(groups.length, 2);
		assert.deepEqual(groups[0]?.ids, ['a', 'b']);
		assert.equal(filterActivityGroups(groups, 'failures').length, 1);
		assert.equal(filterActivityGroups(groups, 'deploys').length, 1);
	});

	it('lists upcoming user jobs in order', () => {
		const jobs = [
			{ environmentID: '0', job: job('auto-update', { nextRun: '2026-10-30T14:00:00Z' }) },
			{ environmentID: '0', job: job('image-polling', { nextRun: '2026-10-30T13:00:00Z' }) },
			{ environmentID: '0', job: job('event-cleanup', { nextRun: '2026-10-30T12:30:00Z' }) },
			{
				environmentID: '0',
				job: job('scheduled-prune', { nextRun: '2026-10-30T12:30:00Z', enabled: false })
			}
		];
		assert.deepEqual(
			upcomingJobs(jobs, now).map((entry) => entry.job.id),
			['image-polling', 'auto-update']
		);
		assert.equal(jobLabel(job('volume-backup:data')), 'Volume Backup: data');
		assert.equal(jobLabel(job('environment-health:2')), 'Health Check');
	});

	it('splits reclaimable space by resource and environment', () => {
		const usage = [
			{
				environmentID: '0',
				usage: {
					unusedImagesBytes: 100,
					buildCacheBytes: 0,
					unusedVolumesBytes: 50,
					stoppedContainersBytes: 0
				}
			},
			{
				environmentID: '1',
				usage: {
					unusedImagesBytes: 300,
					buildCacheBytes: 0,
					unusedVolumesBytes: 0,
					stoppedContainersBytes: 0
				}
			}
		];
		assert.deepEqual(
			reclaimableResources(usage).map((resource) => [resource.key, resource.total]),
			[
				['images', 400],
				['volumes', 50]
			]
		);
		assert.deepEqual(
			reclaimableByEnvironment(usage).map((entry) => entry.environmentID),
			['1', '0']
		);
	});

	it('builds attention items like the web dashboard', () => {
		const items = buildOverviewAttentionItems(
			sources({
				environments: [
					{ id: '0', name: 'Local', status: 'online' },
					{ id: '1', name: 'Edge', status: 'offline', lastSeen: '2026-10-30T11:00:00Z' }
				],
				unhealthy: { '0': 2 },
				events: [
					{
						environmentID: '0',
						event: {
							id: 'e1',
							type: 'container.oom',
							severity: 'error',
							title: '',
							resourceId: 'c1',
							resourceName: 'db',
							timestamp: '2026-10-30T11:50:00Z',
							createdAt: '2026-10-30T11:50:00Z'
						}
					},
					{
						environmentID: '0',
						event: {
							id: 'e2',
							type: 'container.die',
							severity: 'info',
							title: '',
							resourceId: 'c2',
							metadata: { exitCode: '0' },
							timestamp: '2026-10-30T11:55:00Z',
							createdAt: '2026-10-30T11:55:00Z'
						}
					}
				],
				disk: { '0': { percent: 96, used: 96, total: 100 } },
				jobs: [
					{
						environmentID: '0',
						job: job('auto-update', {
							lastRun: { id: 'r1', status: 'failed', finishedAt: '2026-10-30T11:00:00Z' },
							lastError: 'boom'
						})
					}
				],
				expiringKeys: 1,
				versions: {
					'0': {
						currentVersion: '3.0.0',
						revision: '',
						shortRevision: '',
						goVersion: '',
						displayVersion: 'v3.0.0',
						isSemverVersion: true,
						updateAvailable: true,
						newestVersion: 'v3.1.0'
					}
				},
				upgradable: new Set(['0'])
			})
		);
		assert.deepEqual(
			items.map((item) => item.key),
			[
				'offline:1',
				'unhealthy:0',
				'event:0:c1',
				'disk:0',
				'job:0:auto-update',
				'apikeys',
				'version:0'
			]
		);
		assert.equal(items.find((item) => item.key === 'version:0')?.action.kind, 'upgrade');
		assert.equal(items.find((item) => item.key === 'disk:0')?.severity, 'critical');
		const sorted = sortOverviewAttention(items, 'impact');
		assert.equal(sorted.at(-1)?.severity, 'info');
	});
});
