/** Pure pieces of `BusiestContainersStore.swift` (ranking + cache naming). */
import type {
	ContainerResourceSample,
	ContainerResourceSort,
	ContainerSummary
} from '@/sdk/models/container/ContainerSummary';

/** Sort raw value → environment ID → that environment's top containers. */
export type BusiestRankings = Readonly<
	Record<string, Readonly<Record<string, ContainerSummary[]>>>
>;

export type BusiestEntry = {
	environmentID: string;
	container: ContainerSummary;
	sample: ContainerResourceSample;
	id: string;
};

export function topBusiest(
	rankings: BusiestRankings,
	sort: ContainerResourceSort,
	limit: number,
	environments: readonly string[]
): BusiestEntry[] {
	const byEnvironment = rankings[sort] ?? {};
	const entries = environments.flatMap((environmentID) =>
		(byEnvironment[environmentID] ?? []).flatMap((container) =>
			container.resourceSample
				? [
						{
							environmentID,
							container,
							sample: container.resourceSample,
							id: `${environmentID}/${container.id}`
						}
					]
				: []
		)
	);
	const value = (sample: ContainerResourceSample) =>
		sort === 'cpuUsage' ? sample.cpuPercent : sample.memoryUsageBytes;
	// Stable sort, like Swift's `sorted` on equal keys in practice.
	return entries
		.map((entry, index) => ({ entry, index }))
		.sort((a, b) => value(b.entry.sample) - value(a.entry.sample) || a.index - b.index)
		.slice(0, limit)
		.map(({ entry }) => entry);
}

/** Drops environments that left the catalog from every sort's ranking. */
export function pruneRankings(
	rankings: BusiestRankings,
	current: ReadonlySet<string>
): BusiestRankings {
	return Object.fromEntries(
		Object.entries(rankings).map(([sort, byEnvironment]) => [
			sort,
			Object.fromEntries(Object.entries(byEnvironment).filter(([id]) => current.has(id)))
		])
	);
}

/** The cache key holds a server URL; keep the file name to safe characters. */
export function busiestCacheFileName(cacheKey: string): string {
	return `${Array.from(cacheKey)
		.map((c) => (/^[\p{L}\p{N}]$/u.test(c) ? c : '_'))
		.join('')}.json`;
}
