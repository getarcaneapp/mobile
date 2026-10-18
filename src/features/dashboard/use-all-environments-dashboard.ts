import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { useStoredString } from '@/core/storage';
import type { ContainerResourceSort } from '@/sdk/models/container/ContainerSummary';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { SystemStats } from '@/sdk/models/system/SystemStats';
import {
	busiestRefreshIntervalMs,
	useBusiestContainersStore
} from '@/stores/busiest-containers-store';
import { useClientManager } from '@/stores/client-manager';
import { topBusiest } from '@/stores/busiest-containers-logic';
import {
	environmentIsOnline,
	SystemStatsDisplay,
	type StatsSeries
} from '@/stores/dashboard-stream-logic';
import { environmentColorHex, useEnvironmentColorStore } from '@/stores/environment-color-store';
import {
	useMaxStatsStreams,
	useSystemStatsHistoryStore
} from '@/stores/system-stats-history-store';
import { parseHex, systemColors } from '@/theme/colors';

import {
	DashboardTotalsTile,
	displayName,
	fallbackEnvironmentColors,
	smoothedSeries,
	tileValue,
	usageHeadline,
	type AllEnvironmentsCounts,
	type UsageMetric
} from './dashboard-logic';
import type { UsageLine } from './components/usage-chart';
import { relativeTimeFormat } from '@/core/relative-time';

const busiestLimit = 5;

export function useAllEnvironmentsDashboard(
	environments: Environment[],
	counts: AllEnvironmentsCounts
) {
	const serverURL = useClientManager((s) => s.serverURL);
	const userID = useClientManager((s) => s.currentUser?.id);
	const environmentColors = useEnvironmentColorStore((s) => s.colors);
	const maxStreams = useMaxStatsStreams();
	const [storedTiles, setStoredTiles] = useStoredString(
		DashboardTotalsTile.preferenceKey,
		DashboardTotalsTile.encode(DashboardTotalsTile.defaults)
	);
	const [usageMetric, setUsageMetric] = useState<UsageMetric>('CPU');
	const [busiestSort, setBusiestSort] = useState<ContainerResourceSort>('cpuUsage');
	const [showsTileEditor, setShowsTileEditor] = useState(false);

	const environmentIDs = environments.map((e) => e.id);
	const idsKey = environmentIDs.join(',');
	const showsBusiest = useBusiestContainersStore((s) =>
		environmentIDs.some((id) => !s.unsupported.has(id))
	);

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
					const client = useClientManager.getState().client;
					if (client)
						await useBusiestContainersStore.getState().refresh(client, ids, controller.signal);
					await new Promise((resolve) => setTimeout(resolve, busiestRefreshIntervalMs));
				}
			};
			void poll();
			return () => controller.abort();
		}, [serverURL, userID, isActive, idsKey])
	);

	const colorFor = (environment: Environment, index: number): string => {
		const hex = environmentColorHex(environmentColors, serverURL, environment.id);
		return (
			(hex && parseHex(hex)) ||
			systemColors[fallbackEnvironmentColors[index % fallbackEnvironmentColors.length]!]
		);
	};

	const names = new Map(environments.map((e) => [e.id, displayName(e)]));

	return {
		environments,
		counts,
		tiles: DashboardTotalsTile.decode(storedTiles),
		storedTiles,
		setStoredTiles,
		showsTileEditor,
		setShowsTileEditor,

		usageMetric,
		setUsageMetric,
		showsStreamCapNote: environments.length > maxStreams,
		maxStreams,

		showsBusiest,
		environmentIDs,
		busiestSort,
		setBusiestSort,
		environmentName: (id: string) => names.get(id),

		onlineCount: environments.filter(environmentIsOnline).length,
		colorFor
	};
}

export type AllEnvironmentsDashboardModel = ReturnType<typeof useAllEnvironmentsDashboard>;

function liveStats(
	seriesByID: Readonly<Record<string, StatsSeries>>,
	environments: readonly Environment[]
): SystemStats[] {
	return environments.flatMap((e) => {
		const latest = seriesByID[e.id]?.latest;
		return latest ? [latest] : [];
	});
}

export function useTileValues(model: AllEnvironmentsDashboardModel): string[] {
	const { tiles, counts, environments } = model;
	return useSystemStatsHistoryStore(
		useShallow((s) => {
			const live = liveStats(s.seriesByEnvironmentID, environments);
			return tiles.map((tile) => tileValue(tile, counts, environments, live));
		})
	);
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

export function relativeNamed(ms: number, now = Date.now()): string {
	const seconds = Math.round((ms - now) / 1000);
	const format = relativeTimeFormat();
	const abs = Math.abs(seconds);
	if (abs < 60) return format.format(seconds, 'second');
	if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
	if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour');
	return format.format(Math.round(seconds / 86400), 'day');
}
