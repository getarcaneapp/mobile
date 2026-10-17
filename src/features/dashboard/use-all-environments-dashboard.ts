/**
 * Shared state for `AllEnvironmentsDashboard` (the Refreshed Dashboard
 * preview body): chosen totals tiles, the live usage chart's lines and
 * headline, the busiest-containers poll, and host rows.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useStoredString } from '@/core/storage';
import type { ContainerResourceSort } from '@/sdk/models/container/ContainerSummary';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import {
	busiestRefreshIntervalMs,
	useBusiestContainersStore
} from '@/stores/busiest-containers-store';
import { useClientManager } from '@/stores/client-manager';
import { environmentIsOnline, SystemStatsDisplay } from '@/stores/dashboard-stream-logic';
import { useEnvironmentColorStore } from '@/stores/environment-color-store';
import { maxStatsStreams, useSystemStatsHistoryStore } from '@/stores/system-stats-history-store';
import { parseHex, systemColors } from '@/theme/colors';

import {
	DashboardTotalsTile,
	displayName,
	fallbackEnvironmentColors,
	smoothed,
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
	// Re-render when environment colors change.
	useEnvironmentColorStore((s) => s.colors);
	const seriesByID = useSystemStatsHistoryStore((s) => s.seriesByEnvironmentID);
	const [storedTiles, setStoredTiles] = useStoredString(
		DashboardTotalsTile.preferenceKey,
		DashboardTotalsTile.encode(DashboardTotalsTile.defaults)
	);
	const [usageMetric, setUsageMetric] = useState<UsageMetric>('CPU');
	const [busiestSort, setBusiestSort] = useState<ContainerResourceSort>('cpuUsage');
	const [showsTileEditor, setShowsTileEditor] = useState(false);

	const busiest = useBusiestContainersStore();
	const environmentIDs = environments.map((e) => e.id);
	const idsKey = environmentIDs.join(',');

	// Poll the server's shared stats collector while the dashboard is visible and active.
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

	/** The environment's chosen color, else a stable palette slot. */
	const colorFor = (environment: Environment, index: number): string => {
		const hex = useEnvironmentColorStore.getState().hex(serverURL, environment.id);
		return (
			(hex && parseHex(hex)) ||
			systemColors[fallbackEnvironmentColors[index % fallbackEnvironmentColors.length]!]
		);
	};

	const live = environments.flatMap((e) => {
		const latest = seriesByID[e.id]?.latest;
		return latest ? [latest] : [];
	});

	const tiles = DashboardTotalsTile.decode(storedTiles);

	/** Streamed environments only; the rest have no live series. */
	const usageLines: UsageLine[] = environments.flatMap((environment, index) => {
		const series = seriesByID[environment.id];
		if (!series?.latest) return [];
		const samples = usageMetric === 'CPU' ? series.cpu : series.memory;
		return [
			{
				id: environment.id,
				name: displayName(environment),
				color: colorFor(environment, index),
				samples: smoothed(samples),
				current: samples[samples.length - 1]?.value
			}
		];
	});

	const names = new Map(environments.map((e) => [e.id, displayName(e)]));

	return {
		tiles,
		tileValue: (tile: DashboardTotalsTile) => tileValue(tile, counts, environments, live),
		storedTiles,
		setStoredTiles,
		showsTileEditor,
		setShowsTileEditor,

		usageMetric,
		setUsageMetric,
		usageLines,
		headline: usageHeadline(usageMetric, live),
		waitingForStats: usageLines.every((line) => line.samples.length < 2),
		showsStreamCapNote: environments.length > maxStatsStreams(),
		maxStreams: maxStatsStreams(),

		showsBusiest: busiest.supportsAny(environmentIDs),
		busiestSort,
		setBusiestSort,
		busiestEntries: busiest.top(busiestSort, busiestLimit, environmentIDs),
		busiestIsLive: busiest.isLive,
		busiestUpdatedAt: busiest.updatedAt,
		environmentName: (id: string) => names.get(id),

		onlineCount: environments.filter(environmentIsOnline).length,
		colorFor,
		hostStats: (environmentID: string) => seriesByID[environmentID]?.latest,
		diskPercent: (environmentID: string) =>
			SystemStatsDisplay.diskPercent(seriesByID[environmentID]?.latest)
	};
}

/** `Text(updatedAt, format: .relative(presentation: .named))`. */
export function relativeNamed(ms: number, now = Date.now()): string {
	const seconds = Math.round((ms - now) / 1000);
	const format = relativeTimeFormat();
	const abs = Math.abs(seconds);
	if (abs < 60) return format.format(seconds, 'second');
	if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
	if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour');
	return format.format(Math.round(seconds / 86400), 'day');
}
