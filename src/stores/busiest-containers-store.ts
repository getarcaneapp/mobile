import { Directory, File, Paths } from 'expo-file-system';
import { create } from 'zustand';

import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { ContainerListResponse } from '@/sdk/models/container/ContainerDetails';
import type { ContainerResourceSort } from '@/sdk/models/container/ContainerSummary';

import {
	busiestCacheFileName,
	pruneRankings,
	topBusiest,
	type BusiestEntry,
	type BusiestRankings
} from './busiest-containers-logic';

export const busiestRefreshIntervalMs = 5_000;
const perEnvironmentLimit = 5;

type Snapshot = { updatedAt: number; rankings: BusiestRankings };

const directory = () => new Directory(Paths.cache, 'BusiestContainers');

function load(cacheKey: string): Snapshot | undefined {
	try {
		const file = new File(directory(), busiestCacheFileName(cacheKey));
		if (!file.exists) return undefined;
		const raw = JSON.parse(file.textSync()) as Snapshot;
		return typeof raw.updatedAt === 'number' && typeof raw.rankings === 'object' ? raw : undefined;
	} catch {
		return undefined;
	}
}

function persist(cacheKey: string, snapshot: Snapshot) {
	try {
		const dir = directory();
		if (!dir.exists) dir.create({ intermediates: true });
		const file = new File(dir, busiestCacheFileName(cacheKey));
		if (!file.exists) file.create();
		file.writeSync(JSON.stringify(snapshot));
	} catch {}
}

type BusiestContainersState = {
	rankings: BusiestRankings;
	updatedAt: number | undefined;
	isLive: boolean;
	unsupported: ReadonlySet<string>;

	activate: (cacheKey: string) => void;
	top: (
		sort: ContainerResourceSort,
		limit: number,
		environments: readonly string[]
	) => BusiestEntry[];
	supportsAny: (environments: readonly string[]) => boolean;
	refresh: (
		client: ArcaneClient,
		environments: readonly string[],
		signal?: AbortSignal
	) => Promise<void>;
	clearCache: () => void;
};

export const useBusiestContainersStore = create<BusiestContainersState>((set, get) => {
	let cacheKey: string | undefined;

	const apply = (
		response: ContainerListResponse,
		sort: ContainerResourceSort,
		environmentID: string
	) => {
		if (!response.resourceSortSupported) {
			const unsupported = new Set(get().unsupported);
			unsupported.add(environmentID);
			const rankings = Object.fromEntries(
				Object.entries(get().rankings).map(([key, byEnvironment]) => {
					const { [environmentID]: _removed, ...rest } = byEnvironment;
					return [key, rest];
				})
			);
			set({ unsupported, rankings });
			return;
		}
		const ranked = response.data.filter((c) => c.resourceSample !== undefined);
		const existing = get().rankings[sort]?.[environmentID];
		const changed = !existing || JSON.stringify(existing) !== JSON.stringify(ranked);
		set((s) => ({
			...(changed
				? {
						rankings: {
							...s.rankings,
							[sort]: { ...s.rankings[sort], [environmentID]: ranked }
						}
					}
				: {}),
			updatedAt: Date.now(),
			isLive: true
		}));
	};

	return {
		rankings: {},
		updatedAt: undefined,
		isLive: false,
		unsupported: new Set(),

		activate: (key) => {
			if (key === cacheKey) return;
			cacheKey = key;
			const snapshot = load(key);
			set({
				rankings: snapshot?.rankings ?? {},
				updatedAt: snapshot?.updatedAt,
				isLive: false,
				unsupported: new Set()
			});
		},

		top: (sort, limit, environments) => topBusiest(get().rankings, sort, limit, environments),

		supportsAny: (environments) => environments.some((id) => !get().unsupported.has(id)),

		refresh: async (client, environments, signal) => {
			const targets = environments.filter((id) => !get().unsupported.has(id));
			if (targets.length === 0) return;
			const scoped = signal ? client.withSignal(signal) : client;
			const sorts: ContainerResourceSort[] = ['cpuUsage', 'memoryUsage'];
			await Promise.all(
				targets.flatMap((environmentID) =>
					sorts.map(async (sort) => {
						const response = await scoped.containers
							.list({
								envID: environmentID,
								query: { limit: perEnvironmentLimit, sortBy: sort, sortOrder: 'desc' },
								includeHidden: true
							})
							.catch(() => undefined);
						if (signal?.aborted || !response) return;
						apply(response, sort, environmentID);
					})
				)
			);
			if (signal?.aborted) return;
			set((s) => ({ rankings: pruneRankings(s.rankings, new Set(environments)) }));
			const updatedAt = get().updatedAt;
			if (cacheKey && updatedAt !== undefined)
				persist(cacheKey, { updatedAt, rankings: get().rankings });
		},

		clearCache: () => {
			set({ rankings: {}, updatedAt: undefined, isLive: false });
			try {
				const dir = directory();
				if (dir.exists) dir.delete();
			} catch {}
		}
	};
});
