import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { EnvironmentID } from '@/sdk/client/environment';
import type { ContainerResourceSort } from '@/sdk/models/container/ContainerSummary';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { VersionInfo } from '@/sdk/models/version/VersionInfo';
import {
	busiestRefreshIntervalMs,
	useBusiestContainersStore
} from '@/stores/busiest-containers-store';
import { useClientManager } from '@/stores/client-manager';
import { topBusiest } from '@/stores/busiest-containers-logic';
import { environmentIsOnline, SystemStatsDisplay } from '@/stores/dashboard-stream-logic';
import { useDashboardOverviewStore } from '@/stores/dashboard-overview-store';
import { useDashboardStreamStore } from '@/stores/dashboard-stream-store';
import { environmentColorHex, useEnvironmentColorStore } from '@/stores/environment-color-store';
import {
	useMaxStatsStreams,
	useSystemStatsHistoryStore
} from '@/stores/system-stats-history-store';
import { parseHex, systemColors } from '@/theme/colors';

import {
	displayName,
	fallbackEnvironmentColors,
	smoothedSeries,
	usageHeadline,
	type AllEnvironmentsCounts,
	type UsageMetric
} from './dashboard-logic';
import {
	buildOverviewAttentionItems,
	collapseActivities,
	reclaimableByEnvironment,
	reclaimableResources,
	relativeTime,
	totalReclaimable,
	upcomingJobs,
	type DiskStats
} from './dashboard-overview-logic';
import { groupVisibleWidgets } from './dashboard-widgets';
import { useDashboardLayout } from './use-dashboard-layout';
import type { UsageLine } from './components/usage-chart';

const busiestLimit = 5;
const diskWarningPercent = 85;

export function useAllEnvironmentsDashboard(
	environments: Environment[],
	counts: AllEnvironmentsCounts,
	isAdmin: boolean
) {
	const client = useClientManager((s) => s.client);
	const serverURL = useClientManager((s) => s.serverURL);
	const userID = useClientManager((s) => s.currentUser?.id);
	const supportsV3 = useClientManager((s) => s.apiGeneration === 'v3');
	const supportsActivities = useClientManager((s) => s.serverCapabilities?.mode === 'rbac');
	const environmentColors = useEnvironmentColorStore((s) => s.colors);
	const maxStreams = useMaxStatsStreams();
	const layout = useDashboardLayout();
	const [usageMetric, setUsageMetric] = useState<UsageMetric>('CPU');
	const [busiestSort, setBusiestSort] = useState<ContainerResourceSort>('cpuUsage');

	const environmentIDs = environments.map((e) => e.id);
	const idsKey = environmentIDs.join(',');
	const onlineIDsKey = environments
		.filter(environmentIsOnline)
		.map((e) => e.id)
		.join(',');
	const showsBusiest = useBusiestContainersStore((s) =>
		environmentIDs.some((id) => !s.unsupported.has(id))
	);

	useEffect(() => {
		if (!client || !onlineIDsKey) return;
		void useDashboardOverviewStore.getState().load({
			client,
			environmentIDs: onlineIDsKey.split(','),
			supportsV3,
			supportsActivities
		});
	}, [client, onlineIDsKey, supportsV3, supportsActivities]);

	const [isActive, setIsActive] = useState(AppState.currentState === 'active');
	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) =>
			setIsActive(state === 'active')
		);
		return () => subscription.remove();
	}, []);
	useFocusEffect(
		useCallback(() => {
			useBusiestContainersStore.getState().activate(`${serverURL}|${userID ?? ''}`);
			if (!isActive) return;
			const controller = new AbortController();
			const ids = idsKey ? idsKey.split(',') : [];
			const poll = async () => {
				while (!controller.signal.aborted) {
					const current = useClientManager.getState().client;
					if (current)
						await useBusiestContainersStore.getState().refresh(current, ids, controller.signal);
					await new Promise((resolve) => setTimeout(resolve, busiestRefreshIntervalMs));
				}
			};
			void poll();
			return () => controller.abort();
		}, [serverURL, userID, isActive, idsKey])
	);

	const colorFor = (environment: Pick<Environment, 'id'>, index: number): string => {
		const hex = environmentColorHex(environmentColors, serverURL, environment.id);
		return (
			(hex && parseHex(hex)) ||
			systemColors[fallbackEnvironmentColors[index % fallbackEnvironmentColors.length]!]
		);
	};
	const indexByID = new Map(environments.map((e, index) => [e.id, index]));
	const names = new Map(environments.map((e) => [e.id, displayName(e)]));

	const groups = groupVisibleWidgets(layout.visible).filter(
		(group) => group.kind !== 'panel' || group.id !== 'busiest' || showsBusiest
	);

	return {
		environments,
		counts,
		isAdmin,
		supportsV3,
		groups,

		usageMetric,
		setUsageMetric,
		showsStreamCapNote: environments.length > maxStreams,
		maxStreams,

		showsBusiest,
		environmentIDs,
		busiestSort,
		setBusiestSort,
		environmentName: (id: string) => names.get(id),
		environmentColor: (id: string) => colorFor({ id }, indexByID.get(id) ?? 0),

		onlineCount: environments.filter(environmentIsOnline).length,
		colorFor
	};
}

export type AllEnvironmentsDashboardModel = ReturnType<typeof useAllEnvironmentsDashboard>;

export function useHealthyStat(model: AllEnvironmentsDashboardModel) {
	const offline = model.environments.filter((e) => !environmentIsOnline(e));
	return {
		value: `${model.environments.length - offline.length}/${model.environments.length}`,
		detail: offline.length > 0 ? offline.map(displayName).join(', ') : 'All online'
	};
}

function useDiskAlerts(environments: readonly Environment[]): Record<string, DiskStats> {
	const encoded = useSystemStatsHistoryStore((s) =>
		environments
			.flatMap((e) => {
				const latest = s.seriesByEnvironmentID[e.id]?.latest;
				const percent = SystemStatsDisplay.diskPercent(latest);
				if (!latest || percent === undefined || percent < diskWarningPercent) return [];
				return [
					`${e.id}\u001f${Math.round(percent)}\u001f${latest.diskUsage}\u001f${latest.diskTotal}`
				];
			})
			.join('\u001e')
	);
	return Object.fromEntries(
		(encoded ? encoded.split('\u001e') : []).map((entry) => {
			const [id = '', percent, used, total] = entry.split('\u001f');
			return [id, { percent: Number(percent), used: Number(used), total: Number(total) }];
		})
	);
}

export function useOverviewAttention(model: AllEnvironmentsDashboardModel) {
	const { environments } = model;
	const unhealthy = useDashboardStreamStore(
		useShallow((s) =>
			Object.fromEntries(
				environments.map((e) => [
					e.id,
					s.statesByEnvironmentID[e.id]?.snapshot?.containers.counts.unhealthyContainers ?? 0
				])
			)
		)
	);
	const versions = useDashboardStreamStore(
		useShallow((s) =>
			Object.fromEntries(
				environments.flatMap((e) => {
					const info = s.statesByEnvironmentID[e.id]?.snapshot?.versionInfo;
					return info ? [[e.id, info] as [string, VersionInfo]] : [];
				})
			)
		)
	);
	const expiringKeys = useDashboardStreamStore((s) => s.attention.expiringKeys);
	const disk = useDiskAlerts(environments);
	const events = useDashboardOverviewStore((s) => s.events);
	const findings = useDashboardOverviewStore((s) => s.findings);
	const jobs = useDashboardOverviewStore((s) => s.jobs);
	const activities = useDashboardOverviewStore((s) => s.activities);
	const risk = useDashboardOverviewStore((s) => s.risk.status);
	const now = useDashboardOverviewStore((s) => s.loadedAt);

	const items = buildOverviewAttentionItems({
		environments,
		unhealthy,
		events: events.value,
		findings,
		disk,
		jobs: jobs.value,
		activityGroups: collapseActivities(activities.value),
		expiringKeys,
		keysEnvironmentID: EnvironmentID.localDocker,
		versions,
		upgradable: new Set(model.isAdmin ? environments.map((e) => e.id) : []),
		now
	});
	return {
		items,
		critical: items.filter((item) => item.severity === 'critical').length,
		loading: items.length === 0 && (events.status === 'loading' || jobs.status === 'loading'),
		failed: [events.status, jobs.status, risk].includes('failed')
	};
}

export function useRiskStat() {
	const risk = useDashboardOverviewStore((s) => s.risk);
	const overview = risk.value;
	const score = overview && overview.scoreStatus !== 'unavailable' ? overview.riskScore : undefined;
	return {
		score,
		delta: overview?.delta7d,
		knownExploited: overview?.drivers.knownExploited ?? 0,
		loading: risk.status === 'loading' && !overview,
		failed: risk.status === 'failed'
	};
}

export function useReclaimable() {
	const diskUsage = useDashboardOverviewStore((s) => s.diskUsage);
	return {
		total: totalReclaimable(diskUsage.value),
		resources: reclaimableResources(diskUsage.value),
		topEnvironments: reclaimableByEnvironment(diskUsage.value),
		environmentCount: diskUsage.value.length,
		loading: diskUsage.status === 'loading' && diskUsage.value.length === 0,
		failed: diskUsage.status === 'failed'
	};
}

export function useRecentActivity() {
	const activities = useDashboardOverviewStore((s) => s.activities);
	return {
		groups: collapseActivities(activities.value),
		loading: activities.status === 'loading' && activities.value.length === 0,
		failed: activities.status === 'failed'
	};
}

export function useUpcomingJobs() {
	const jobs = useDashboardOverviewStore((s) => s.jobs);
	const now = useDashboardOverviewStore((s) => s.loadedAt);
	return {
		jobs: upcomingJobs(jobs.value, now),
		loading: jobs.status === 'loading' && jobs.value.length === 0,
		failed: jobs.status === 'failed'
	};
}

export function useTopMemory(model: AllEnvironmentsDashboardModel) {
	const rankings = useBusiestContainersStore((s) => s.rankings);
	const isLive = useBusiestContainersStore((s) => s.isLive);
	return {
		entries: topBusiest(rankings, 'memoryUsage', busiestLimit, model.environmentIDs).filter(
			(entry) => entry.sample.memoryUsageBytes > 0
		),
		loading: !isLive
	};
}

export function useUsageCard(model: AllEnvironmentsDashboardModel) {
	const { environments, usageMetric, colorFor } = model;
	const seriesList = useSystemStatsHistoryStore(
		useShallow((s) => environments.map((e) => s.seriesByEnvironmentID[e.id]))
	);
	const usageLines: UsageLine[] = environments.flatMap((environment, index) => {
		const series = seriesList[index];
		if (!series?.latest) return [];
		const samples = usageMetric === 'CPU' ? series.cpu : series.memory;
		return [
			{
				id: environment.id,
				name: displayName(environment),
				color: colorFor(environment, index),
				samples: smoothedSeries(samples),
				current: samples[samples.length - 1]?.value
			}
		];
	});
	const live = seriesList.flatMap((series) => (series?.latest ? [series.latest] : []));
	return {
		usageLines,
		headline: usageHeadline(usageMetric, live),
		waitingForStats: usageLines.every((line) => line.samples.length < 2)
	};
}

export function useBusiestCard(model: AllEnvironmentsDashboardModel) {
	const { environmentIDs, busiestSort } = model;
	const rankings = useBusiestContainersStore((s) => s.rankings);
	const isLive = useBusiestContainersStore((s) => s.isLive);
	const updatedAt = useBusiestContainersStore((s) => (s.isLive ? undefined : s.updatedAt));
	return {
		entries: topBusiest(rankings, busiestSort, busiestLimit, environmentIDs),
		isLive,
		updatedAt
	};
}

export function useHostDiskPercent(environmentID: string): number | undefined {
	return useSystemStatsHistoryStore((s) => {
		const percent = SystemStatsDisplay.diskPercent(s.seriesByEnvironmentID[environmentID]?.latest);
		return percent === undefined ? undefined : Math.round(percent * 100) / 100;
	});
}

export const relativeNamed = relativeTime;
