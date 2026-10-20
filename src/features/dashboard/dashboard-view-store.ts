import { createStore } from 'zustand/vanilla';

import type { Activity } from '@/sdk/models/activity/Activity';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { useActivityHistoryMutationStore } from '@/stores/activity-history-mutation-store';
import { useBusiestContainersStore } from '@/stores/busiest-containers-store';
import { useClientManager } from '@/stores/client-manager';
import { useDashboardStreamStore } from '@/stores/dashboard-stream-store';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { useImageUpdateCountStore } from '@/stores/image-update-count-store';
import { useSystemStatsHistoryStore } from '@/stores/system-stats-history-store';

import {
	aggregateLiveCounts,
	dashboardEnvironments,
	environmentBatchSize,
	liveStatesFrom,
	mergeFailedActivities,
	resolveImageUpdateCount,
	retainingActiveActivities,
	type DashboardEnvironmentLiveStates,
	type DashboardLiveCounts
} from './dashboard-logic';

type CountResult = {
	total: number | undefined;
	unavailableEnvironmentIDs: string[];
	counts: Record<string, number>;
};

export type DashboardViewState = {
	allEnvironments: Environment[];
	environments: Environment[];
	volumesTotal: number | undefined;
	volumeCounts: Readonly<Record<string, number>>;
	supplementalImageUpdatesTotal: number | undefined;
	liveCounts: DashboardLiveCounts | undefined;
	environmentLiveStates: DashboardEnvironmentLiveStates;
	volumeCountUnavailableEnvironmentIDs: string[];
	updateCountUnavailableEnvironmentIDs: string[];
	hasLoadedEnvironmentCounts: boolean;
	failedActivities: Activity[];
	rawEnvironmentCount: number;
	isLoading: boolean;
	hasLoadedOnce: boolean;
	hasLoadedEnvironments: boolean;
	cardRefreshToken: number;
	visibleEnvironmentCount: number;
	needsRefreshOnAppear: boolean;
	lastRefreshAt: number | undefined;

	imageUpdatesTotal: () => number | undefined;
	loadData: (refresh?: boolean) => Promise<void>;
	refreshDashboard: (reconnectStream?: boolean) => Promise<void>;
	refreshLiveCounts: () => Promise<void>;
	refreshEnvironmentDockerInfo: (environmentID: string) => Promise<void>;
	updateLiveStateFromStore: () => void;
	updateEnvironmentCatalogFromStore: () => void;
	reorderForActiveEnvironment: () => void;
	showNextEnvironmentBatch: () => void;
	applyHistoryClear: () => void;
};

const enabled = (environments: readonly Environment[]) => environments.filter((e) => e.enabled);

export function createDashboardViewStore(isCancelled: () => boolean) {
	return createStore<DashboardViewState>((set, get) => {
		const manager = () => useClientManager.getState();
		const environmentsStore = () => useEnvironmentsStore.getState();

		const ordered = (envs: readonly Environment[]) =>
			dashboardEnvironments(envs, manager().activeEnvironmentID, get().visibleEnvironmentCount);

		const loadEnvironmentsCached = async (refresh: boolean): Promise<Environment[] | undefined> => {
			await environmentsStore().load({ refresh });
			if (!environmentsStore().hasLoaded) return undefined;
			const fresh = environmentsStore().environments;
			set({
				hasLoadedEnvironments: true,
				rawEnvironmentCount: fresh.length,
				allEnvironments: fresh,
				environments: ordered(fresh)
			});
			return fresh;
		};

		const volumeCount = async (environmentID: string): Promise<number | undefined> => {
			const client = manager().client;
			if (!client) return undefined;
			try {
				return (await client.volumes.counts({ envID: environmentID })).total;
			} catch {}
			try {
				return (await client.volumes.list({ envID: environmentID, query: { start: 0, limit: 1 } }))
					.pagination.totalItems;
			} catch {
				return undefined;
			}
		};

		const loadVolumesTotal = async (envs: Environment[]): Promise<CountResult> => {
			if (!manager().client)
				return { total: undefined, unavailableEnvironmentIDs: envs.map((e) => e.id), counts: {} };
			if (envs.length === 0) return { total: 0, unavailableEnvironmentIDs: [], counts: {} };
			const results = await Promise.all(
				envs.map(async (e) => [e.id, await volumeCount(e.id)] as const)
			);
			const counts: Record<string, number> = {};
			for (const [id, count] of results) if (count !== undefined) counts[id] = count;
			const unavailable = envs.filter((e) => counts[e.id] === undefined).map((e) => e.id);
			return {
				total:
					unavailable.length === 0 ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined,
				unavailableEnvironmentIDs: unavailable,
				counts
			};
		};

		const loadImageUpdatesTotal = async (
			envs: Environment[],
			replace: boolean
		): Promise<CountResult> => {
			const client = manager().client;
			if (!client)
				return { total: undefined, unavailableEnvironmentIDs: envs.map((e) => e.id), counts: {} };
			if (envs.length === 0) return { total: 0, unavailableEnvironmentIDs: [], counts: {} };
			const results = await Promise.all(
				envs.map(async (e) => {
					const summary = await client.images.updateSummary({ envID: e.id }).catch(() => undefined);
					return [e.id, summary?.imagesWithUpdates] as const;
				})
			);
			const counts: Record<string, number> = {};
			for (const [id, count] of results) if (count !== undefined) counts[id] = count;
			const countStore = useImageUpdateCountStore.getState();
			if (replace) countStore.setCounts(counts, manager().client, manager().currentUser?.id);
			else countStore.setSummaryCounts(counts, manager().client, manager().currentUser?.id);
			const unavailable = envs.filter((e) => counts[e.id] === undefined).map((e) => e.id);
			return {
				total:
					unavailable.length === 0 ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined,
				unavailableEnvironmentIDs: unavailable,
				counts
			};
		};

		const loadFailedWork = async (): Promise<Activity[]> => {
			const client = manager().client;
			if (!manager().supportsActivities() || !client) return [];
			const targets = get().allEnvironments.map((e) => {
				const name = e.name?.trim() ?? '';
				return { id: e.id, name: name ? name : e.id };
			});
			if (targets.length === 0) return [];
			const perEnvironment = await Promise.all(
				targets.map(async (target) => {
					const response = await client.activities
						.listPaginated({
							envID: target.id,
							order: 'desc',
							start: 0,
							limit: 3,
							status: 'failed'
						})
						.catch(() => undefined);
					return { ...target, activities: response?.data ?? [] };
				})
			);
			return mergeFailedActivities(perEnvironment);
		};

		return {
			allEnvironments: [],
			environments: [],
			volumesTotal: undefined,
			volumeCounts: {},
			supplementalImageUpdatesTotal: undefined,
			liveCounts: undefined,
			environmentLiveStates: {},
			volumeCountUnavailableEnvironmentIDs: [],
			updateCountUnavailableEnvironmentIDs: [],
			hasLoadedEnvironmentCounts: false,
			failedActivities: [],
			rawEnvironmentCount: 0,
			isLoading: false,
			hasLoadedOnce: false,
			hasLoadedEnvironments: false,
			cardRefreshToken: 0,
			visibleEnvironmentCount: environmentBatchSize,
			needsRefreshOnAppear: false,
			lastRefreshAt: undefined,

			imageUpdatesTotal: () => {
				const m = manager();
				const shared = useImageUpdateCountStore.getState().total(
					m.client,
					m.currentUser?.id,
					enabled(get().allEnvironments).map((e) => e.id)
				);
				return resolveImageUpdateCount(
					shared,
					useDashboardStreamStore.getState().aggregate?.imageUpdates,
					get().supplementalImageUpdatesTotal
				);
			},

			loadData: async (refresh = false) => {
				if (!manager().client) return;
				set({ needsRefreshOnAppear: false, lastRefreshAt: Date.now() });
				if (refresh) set((s) => ({ cardRefreshToken: s.cardRefreshToken + 1 }));
				if (refresh || get().allEnvironments.length === 0)
					set({ visibleEnvironmentCount: environmentBatchSize });
				if (!refresh) {
					set({
						volumesTotal: undefined,
						volumeCounts: {},
						supplementalImageUpdatesTotal: undefined,
						liveCounts: undefined,
						environmentLiveStates: {},
						volumeCountUnavailableEnvironmentIDs: [],
						updateCountUnavailableEnvironmentIDs: [],
						hasLoadedEnvironmentCounts: false
					});
				}
				if (!get().hasLoadedOnce) set({ isLoading: true });
				try {
					const envResult = await loadEnvironmentsCached(refresh);
					if (isCancelled()) return;
					const envs = envResult ?? [];
					set({
						...(envResult ? { hasLoadedEnvironments: true } : {}),
						rawEnvironmentCount: envs.length,
						allEnvironments: envs,
						environments: ordered(envs),
						hasLoadedOnce: true,
						isLoading: false
					});

					const enabledEnvironments = enabled(envs);
					const [volumes, updates] = await Promise.all([
						loadVolumesTotal(enabledEnvironments),
						loadImageUpdatesTotal(enabledEnvironments, refresh)
					]);
					if (!isCancelled()) {
						set({
							...(volumes.total !== undefined ? { volumesTotal: volumes.total } : {}),
							volumeCounts: volumes.counts,
							volumeCountUnavailableEnvironmentIDs: volumes.unavailableEnvironmentIDs,
							...(updates.total !== undefined
								? { supplementalImageUpdatesTotal: updates.total }
								: {}),
							updateCountUnavailableEnvironmentIDs: updates.unavailableEnvironmentIDs
						});
						get().updateLiveStateFromStore();
						set({ hasLoadedEnvironmentCounts: true });
					}

					const clearSequence = useActivityHistoryMutationStore.getState().latestClear?.sequence;
					let activities = await loadFailedWork();
					if (!isCancelled()) {
						const clearEvent = useActivityHistoryMutationStore.getState().latestClear;
						if (clearEvent && clearEvent.sequence !== clearSequence) {
							activities = retainingActiveActivities(activities, clearEvent.environmentIDs);
						}
						set({ failedActivities: activities });
					}
				} finally {
					set({ isLoading: false, ...(isCancelled() ? {} : { hasLoadedOnce: true }) });
				}
			},

			refreshDashboard: async (reconnectStream = true) => {
				set({ supplementalImageUpdatesTotal: get().imageUpdatesTotal() });
				if (reconnectStream) {
					useDashboardStreamStore.getState().reconnect();
					useSystemStatsHistoryStore.getState().reconnect();
				}
				await get().loadData(true);
				const client = manager().client;
				if (client && manager().refreshedDashboardPreview)
					void useBusiestContainersStore.getState().refresh(
						client,
						enabled(get().allEnvironments).map((e) => e.id)
					);
				await environmentsStore().refreshDockerInformation(client);
				await environmentsStore().refreshActionItems(client);
				if (isCancelled()) return;
				get().updateLiveStateFromStore();
				set({ hasLoadedEnvironmentCounts: true });
			},

			refreshLiveCounts: async () => {
				await environmentsStore().refreshDockerInformation(manager().client, true);
				if (isCancelled()) return;
				get().updateLiveStateFromStore();
			},

			refreshEnvironmentDockerInfo: async (environmentID) => {
				await environmentsStore().refreshDockerInformationFor(environmentID, manager().client);
				get().updateLiveStateFromStore();
			},

			updateLiveStateFromStore: () => {
				const enabledEnvironments = enabled(get().allEnvironments);
				const states = liveStatesFrom(
					enabledEnvironments,
					environmentsStore().dockerInfoByEnvironmentID
				);
				set({
					environmentLiveStates: states,
					liveCounts: aggregateLiveCounts(states, enabledEnvironments.length)
				});
			},

			updateEnvironmentCatalogFromStore: () => {
				if (!environmentsStore().hasLoaded) return;
				const fresh = environmentsStore().environments;
				set({
					hasLoadedEnvironments: true,
					rawEnvironmentCount: fresh.length,
					allEnvironments: fresh,
					environments: ordered(fresh),
					hasLoadedOnce: true,
					isLoading: false
				});
			},

			reorderForActiveEnvironment: () => {
				const source =
					get().allEnvironments.length === 0 ? get().environments : get().allEnvironments;
				set({ environments: ordered(source) });
				environmentsStore().prioritizeStats(manager().activeEnvironmentID);
			},

			showNextEnvironmentBatch: () => {
				const { environments, allEnvironments, visibleEnvironmentCount } = get();
				if (environments.length >= allEnvironments.length) return;
				set({
					visibleEnvironmentCount: Math.min(
						visibleEnvironmentCount + environmentBatchSize,
						allEnvironments.length
					)
				});
				set({ environments: ordered(allEnvironments) });
			},

			applyHistoryClear: () => {
				const event = useActivityHistoryMutationStore.getState().latestClear;
				if (!event) return;
				set({
					failedActivities: retainingActiveActivities(get().failedActivities, event.environmentIDs)
				});
			}
		};
	});
}

export type DashboardViewStore = ReturnType<typeof createDashboardViewStore>;
