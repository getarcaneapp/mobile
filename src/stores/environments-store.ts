/**
 * Port of `EnvironmentsStore.swift`: the shared environment catalog for the
 * Dashboard, Environments, and All Environments resource lists, plus the
 * per-environment Docker info pass.
 *
 * Swift owns a `DashboardStreamStore` and `SystemStatsHistoryStore`. They
 * plug in through `EnvironmentDetailStreams`, registered by
 * `environment-detail-streams.ts` (imported by the dashboard). Until then
 * the defaults are no-ops.
 */
import { create } from 'zustand';

import { cachedClient } from '@/core/networking/use-cached-client';
import { progressiveFanOut } from '@/core/networking/pagination-loader';
import { boundedDirectResponse, RemoteDataLimits } from '@/core/networking/remote-data-limits';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { DockerInfo } from '@/sdk/models/system/DockerInfo';
import type { ActionItems } from '@/sdk/models/dashboard';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentColorStore } from '@/stores/environment-color-store';

/** Swift `Environment.displayName` (Models.swift). */
export function environmentDisplayName(environment: Pick<Environment, 'id' | 'name'>): string {
	return environment.name ? environment.name : `Environment ${environment.id}`;
}

/** An environment a resource list loads from. `name` is set only for All Environments. */
export interface ListEnvironment {
	id: EnvironmentID;
	name?: string;
}

/**
 * Hooks for the dashboard stream / stats history stores Swift keeps on
 * `EnvironmentsStore`. Registered by `environment-detail-streams.ts`.
 */
export interface EnvironmentDetailStreams {
	configure(client: ArcaneClient | undefined): void;
	start(options: { dashboardStream: boolean }): void;
	stop(): void;
	reconcile(environments: Environment[]): void;
	prioritizeStats(ordered: Environment[]): void;
	/** Refreshes dashboard snapshots (all environments when `environmentIDs` is omitted). */
	refreshSnapshots(environmentIDs?: string[]): Promise<void>;
	/** Whether the aggregated stream currently delivers snapshots. */
	isStreaming(): boolean;
	actionItems(environmentID: string): ActionItems | undefined;
}

const noopStreams: EnvironmentDetailStreams = {
	configure: () => {},
	start: () => {},
	stop: () => {},
	reconcile: () => {},
	prioritizeStats: () => {},
	refreshSnapshots: async () => {},
	isStreaming: () => false,
	actionItems: () => undefined
};

let streams: EnvironmentDetailStreams = noopStreams;

export function registerEnvironmentDetailStreams(implementation: EnvironmentDetailStreams) {
	streams = implementation;
}

type EnvironmentsState = {
	environments: Environment[];
	environmentCatalogRevision: number;
	dockerInfoByEnvironmentID: Readonly<Record<string, DockerInfo>>;
	unavailableEnvironmentIDs: ReadonlySet<string>;
	dockerInformationRevision: number;
	isLoading: boolean;
	hasLoaded: boolean;
	errorMessage: string | undefined;

	configure: (client: ArcaneClient | undefined) => void;
	setVisible: (visible: boolean, consumer: string, supportsDashboardStream: boolean) => void;
	load: (options?: { refresh?: boolean; loadsEnvironmentDetails?: boolean }) => Promise<void>;
	refreshDockerInformationFor: (
		environmentID: string,
		client: ArcaneClient | undefined
	) => Promise<void>;
	refreshDockerInformation: (client: ArcaneClient | undefined, restart?: boolean) => Promise<void>;
	refreshActionItems: (client: ArcaneClient | undefined) => Promise<void>;
	actionItems: (environmentID: string) => ActionItems | undefined;
	prioritizeStats: (activeEnvironmentID: string) => void;
	/** Enabled environments sorted by name, as listed in All Environments views. */
	enabledEnvironments: () => Environment[];
	displayName: (environmentID: EnvironmentID) => string | undefined;
	/** The environments a resource list loads: `environmentID` alone, or every enabled one. */
	listEnvironments: (
		environmentID: EnvironmentID,
		allEnvironments: boolean
	) => Promise<ListEnvironment[]>;
};

export const useEnvironmentsStore = create<EnvironmentsState>((set, get) => {
	let loadGeneration = 0;
	let clientIdentity: object | undefined;
	let dockerInformationTask: Promise<void> | undefined;
	let dockerInformationTaskID = 0;
	let actionItemsTask: Promise<void> | undefined;
	let actionItemsTaskID = 0;
	/**
	 * Whether the docker info and snapshot passes ran for the current catalog.
	 * A list-only load fetches the catalog without them; the Dashboard starts them.
	 */
	let hasStartedEnvironmentDetails = false;
	let loadWaiters: (() => void)[] = [];
	const visibleConsumers = new Set<string>();
	const dashboardStreamConsumers = new Set<string>();

	const resumeWaiters = () => {
		const waiters = loadWaiters;
		loadWaiters = [];
		for (const resume of waiters) resume();
	};

	const updateStreams = () => {
		if (visibleConsumers.size === 0 || clientIdentity === undefined) streams.stop();
		else streams.start({ dashboardStream: dashboardStreamConsumers.size > 0 });
	};

	const statsOrdered = (activeEnvironmentID: string): Environment[] => {
		const environments = get().environments;
		const index = environments.findIndex((e) => e.id === activeEnvironmentID);
		if (index < 0) return environments;
		const ordered = [...environments];
		const [active] = ordered.splice(index, 1);
		return active ? [active, ...ordered] : ordered;
	};

	const loadDockerInformation = async (client: ArcaneClient, identity: object, taskID: number) => {
		const enabledIDs = get()
			.environments.filter((e) => e.enabled)
			.map((e) => e.id);
		const enabledSet = new Set(enabledIDs);
		const infos = get().dockerInfoByEnvironmentID;
		const pruned = Object.fromEntries(Object.entries(infos).filter(([id]) => enabledSet.has(id)));
		const unavailable = new Set(
			[...get().unavailableEnvironmentIDs].filter((id) => enabledSet.has(id))
		);
		set({ dockerInfoByEnvironmentID: pruned, unavailableEnvironmentIDs: unavailable });

		// Every environment loads at once; results publish as they arrive,
		// coalesced so the dashboard re-renders a few times, not once per env.
		await progressiveFanOut(
			enabledIDs,
			async (environmentID) => {
				const info = await boundedDirectResponse<DockerInfo>(
					client,
					client.rest.environmentPath(environmentID, 'system/docker/info'),
					{ maximumBytes: RemoteDataLimits.maximumInspectBytes, decode: DockerInfo.decode }
				).catch(() => undefined);
				return [environmentID, info] as const;
			},
			(batch) => {
				if (identity !== clientIdentity || taskID !== dockerInformationTaskID) return;
				const nextInfos = { ...get().dockerInfoByEnvironmentID };
				const nextUnavailable = new Set(get().unavailableEnvironmentIDs);
				for (const [environmentID, info] of batch) {
					if (info) {
						nextInfos[environmentID] = info;
						nextUnavailable.delete(environmentID);
					} else {
						delete nextInfos[environmentID];
						nextUnavailable.add(environmentID);
					}
				}
				set((s) => ({
					dockerInfoByEnvironmentID: nextInfos,
					unavailableEnvironmentIDs: nextUnavailable,
					dockerInformationRevision: s.dockerInformationRevision + 1
				}));
			}
		);
	};

	const startDockerInformationLoad = (client: ArcaneClient): Promise<void> => {
		const identity = client.transport;
		const taskID = ++dockerInformationTaskID;
		const task = loadDockerInformation(client, identity, taskID).finally(() => {
			if (dockerInformationTaskID === taskID) dockerInformationTask = undefined;
		});
		dockerInformationTask = task;
		return task;
	};

	/**
	 * Dashboard snapshots carry each environment's action items. While the
	 * aggregated stream runs it delivers them on connect, so a REST pass is
	 * only needed without a stream or when a refresh must not wait.
	 */
	const startActionItemsLoad = (refreshesSnapshots: boolean): Promise<void> => {
		const taskID = ++actionItemsTaskID;
		const task = (async () => {
			if (refreshesSnapshots || !streams.isStreaming()) await streams.refreshSnapshots();
		})().finally(() => {
			if (actionItemsTaskID === taskID) actionItemsTask = undefined;
		});
		actionItemsTask = task;
		return task;
	};

	const startEnvironmentDetails = (client: ArcaneClient, refreshesSnapshots = false) => {
		hasStartedEnvironmentDetails = true;
		void startDockerInformationLoad(client);
		void startActionItemsLoad(refreshesSnapshots);
	};

	const sameEnvironments = (a: Environment[], b: Environment[]) =>
		a.length === b.length && a.every((env, i) => JSON.stringify(env) === JSON.stringify(b[i]));

	const apply = (
		environments: Environment[],
		activeEnvironmentID: string,
		server: string,
		forcesRevision: boolean
	) => {
		if (!forcesRevision && sameEnvironments(environments, get().environments)) return;
		useEnvironmentColorStore.getState().assignDefaults(
			server,
			environments.map((e) => e.id)
		);
		set((s) => ({ environments, environmentCatalogRevision: s.environmentCatalogRevision + 1 }));
		streams.reconcile(environments);
		get().prioritizeStats(activeEnvironmentID);
	};

	return {
		environments: [],
		environmentCatalogRevision: 0,
		dockerInfoByEnvironmentID: {},
		unavailableEnvironmentIDs: new Set(),
		dockerInformationRevision: 0,
		isLoading: false,
		hasLoaded: false,
		errorMessage: undefined,

		configure: (client) => {
			const identity = client?.transport;
			if (identity === clientIdentity) return;
			dockerInformationTask = undefined;
			dockerInformationTaskID += 1;
			actionItemsTask = undefined;
			actionItemsTaskID += 1;
			hasStartedEnvironmentDetails = false;
			loadGeneration += 1;
			resumeWaiters();
			clientIdentity = identity;
			streams.configure(client);
			set((s) => ({
				isLoading: false,
				environments: [],
				environmentCatalogRevision: s.environmentCatalogRevision + 1,
				dockerInfoByEnvironmentID: {},
				unavailableEnvironmentIDs: new Set(),
				dockerInformationRevision: s.dockerInformationRevision + 1,
				hasLoaded: false,
				errorMessage: undefined
			}));
			updateStreams();
		},

		setVisible: (visible, consumer, supportsDashboardStream) => {
			if (visible) {
				visibleConsumers.add(consumer);
				if (supportsDashboardStream) dashboardStreamConsumers.add(consumer);
				else dashboardStreamConsumers.delete(consumer);
			} else {
				visibleConsumers.delete(consumer);
				dashboardStreamConsumers.delete(consumer);
			}
			updateStreams();
		},

		load: async ({ refresh = false, loadsEnvironmentDetails = true } = {}) => {
			const manager = useClientManager.getState();
			get().configure(manager.client);
			const client = manager.client;
			const cached = cachedClient();
			if (!client || !cached) return;
			if (get().hasLoaded && !refresh) {
				if (loadsEnvironmentDetails && !hasStartedEnvironmentDetails)
					startEnvironmentDetails(client);
				return;
			}
			if (get().isLoading) {
				await new Promise<void>((resolve) => loadWaiters.push(resolve));
				if (loadsEnvironmentDetails && get().hasLoaded && !hasStartedEnvironmentDetails) {
					startEnvironmentDetails(client);
				}
				return;
			}
			const generation = loadGeneration;
			const session = manager.cacheSessionIdentity;
			const activeEnvironmentID = manager.activeEnvironmentID;
			set({ isLoading: true, ...(get().hasLoaded ? {} : { errorMessage: undefined }) });
			try {
				const loaded = await cached.getAllPagesGlobal<Environment>(
					'environments',
					async (start, limit) => {
						const response = await client.environments.list({
							query: { start, limit, sortOrder: 'asc' }
						});
						return { items: response.data, pagination: response.pagination };
					}
				);
				if (
					generation !== loadGeneration ||
					session !== useClientManager.getState().cacheSessionIdentity
				)
					return;
				const isFirstLoad = !get().hasLoaded;
				set({ hasLoaded: true });
				apply(loaded, activeEnvironmentID, manager.serverURL, isFirstLoad);
				set({ errorMessage: undefined });
				if (loadsEnvironmentDetails) startEnvironmentDetails(client, refresh);
			} catch (error) {
				if (isCancellation(error)) return;
				if (
					generation !== loadGeneration ||
					session !== useClientManager.getState().cacheSessionIdentity
				)
					return;
				if (!get().hasLoaded) set({ errorMessage: friendlyErrorMessage(error) });
			} finally {
				if (generation === loadGeneration) {
					set({ isLoading: false });
					resumeWaiters();
				}
			}
		},

		refreshDockerInformationFor: async (environmentID, client) => {
			if (!client) return;
			const generation = loadGeneration;
			const identity = client.transport;
			if (identity !== clientIdentity) return;
			const [info] = await Promise.all([
				boundedDirectResponse<DockerInfo>(
					client,
					client.rest.environmentPath(environmentID, 'system/docker/info'),
					{
						maximumBytes: RemoteDataLimits.maximumInspectBytes,
						decode: DockerInfo.decode
					}
				).catch(() => undefined),
				streams.refreshSnapshots([environmentID])
			]);
			if (generation !== loadGeneration || identity !== clientIdentity) return;
			const infos = { ...get().dockerInfoByEnvironmentID };
			const unavailable = new Set(get().unavailableEnvironmentIDs);
			if (info) {
				infos[environmentID] = info;
				unavailable.delete(environmentID);
			} else {
				delete infos[environmentID];
				unavailable.add(environmentID);
			}
			set((s) => ({
				dockerInfoByEnvironmentID: infos,
				unavailableEnvironmentIDs: unavailable,
				dockerInformationRevision: s.dockerInformationRevision + 1
			}));
		},

		/** Awaits the docker info pass, joining one in flight unless `restart`. */
		refreshDockerInformation: async (client, restart = false) => {
			if (!client) return;
			await ((!restart ? dockerInformationTask : undefined) ?? startDockerInformationLoad(client));
		},

		/** Awaits the dashboard snapshot (action items) pass, joining one in flight. */
		refreshActionItems: async (client) => {
			if (!client) return;
			await (actionItemsTask ?? startActionItemsLoad(true));
		},

		actionItems: (environmentID) => streams.actionItems(environmentID),

		prioritizeStats: (activeEnvironmentID) =>
			streams.prioritizeStats(statsOrdered(activeEnvironmentID)),

		enabledEnvironments: () =>
			get()
				.environments.filter((e) => e.enabled)
				.sort((a, b) =>
					environmentDisplayName(a).localeCompare(environmentDisplayName(b), undefined, {
						numeric: true
					})
				),

		displayName: (environmentID) => {
			const environment = get().environments.find((e) => e.id === environmentID);
			return environment ? environmentDisplayName(environment) : undefined;
		},

		listEnvironments: async (environmentID, allEnvironments) => {
			if (!allEnvironments) return [{ id: environmentID }];
			// Always refetch the catalog (deduplicated with any load in flight) so a
			// newly added or disabled environment shows up right away.
			await get().load({ refresh: get().hasLoaded, loadsEnvironmentDetails: false });
			return get()
				.enabledEnvironments()
				.map((e) => ({ id: e.id, name: environmentDisplayName(e) }));
		}
	};
});
