/**
 * Port of `EnvironmentPagedList.swift` + `EnvironmentItem`: progressive
 * pagination for a resource list that loads from one environment, or from
 * every enabled environment with the All Environments preview. Each
 * environment keeps its own cursor; Load More fetches the next page of every
 * environment that still has more.
 */
import { useRef, useSyncExternalStore } from 'react';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import {
	PaginationLoader,
	ProgressivePaginationState,
	progressiveFanOut,
	type Identifiable,
	type ResourcePage
} from '@/core/networking/pagination-loader';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ListEnvironment } from '@/stores/environments-store';
import { usePinnedItemsStore, type PinnedItemKind } from '@/stores/pinned-items-store';

/**
 * A resource paired with the environment it came from, so rows and actions
 * always target the item's own environment, including in mixed lists.
 */
export interface EnvironmentItem<Value extends Identifiable> {
	environmentID: EnvironmentID;
	/** Set only in All Environments lists. */
	environmentName?: string;
	value: Value;
	/**
	 * Single-environment lists keep the resource's own ID; All Environments
	 * lists prefix it so the same name in two environments stays two rows.
	 */
	id: string;
}

export function environmentItem<Value extends Identifiable>(
	value: Value,
	environment: ListEnvironment
): EnvironmentItem<Value> {
	return {
		environmentID: environment.id,
		environmentName: environment.name,
		value,
		id: environment.name === undefined ? value.id : `${environment.id}/${value.id}`
	};
}

export interface EnvironmentLoadFailure {
	environment: ListEnvironment;
	message: string;
}

export type EnvironmentFetch<Value> = (
	environmentID: EnvironmentID,
	start: number,
	limit: number
) => Promise<ResourcePage<Value>>;

type PageResult<Value> = {
	environment: ListEnvironment;
	start: number;
	limit: number;
	outcome: { ok: true; page: ResourcePage<Value> } | { ok: false; error: unknown };
};

export interface EnvironmentPagedListSnapshot<Value extends Identifiable> {
	items: EnvironmentItem<Value>[];
	/** Bumped on every change to `items`, including each environment's rows arriving mid-reload. */
	revision: number;
	environments: ListEnvironment[];
	isLoading: boolean;
	isLoadingMore: boolean;
	/** Set when no environment could be loaded. */
	errorMessage: string | undefined;
	loadMoreError: string | undefined;
	/** Environments that failed while others loaded. All Environments only. */
	failedEnvironments: EnvironmentLoadFailure[];
	showsAllEnvironments: boolean;
	hasMore: boolean;
	/** Sum of every environment's reported total, or undefined while any is unknown. */
	totalItems: number | undefined;
}

async function fetchPage<Value>(
	environment: ListEnvironment,
	start: number,
	limit: number,
	fetch: EnvironmentFetch<Value>
): Promise<PageResult<Value>> {
	try {
		return {
			environment,
			start,
			limit,
			outcome: { ok: true, page: await fetch(environment.id, start, limit) }
		};
	} catch (error) {
		return { environment, start, limit, outcome: { ok: false, error } };
	}
}

export class EnvironmentPagedList<Value extends Identifiable> {
	private state: EnvironmentPagedListSnapshot<Value> = {
		items: [],
		revision: 0,
		environments: [],
		isLoading: false,
		isLoadingMore: false,
		errorMessage: undefined,
		loadMoreError: undefined,
		failedEnvironments: [],
		showsAllEnvironments: false,
		hasMore: false,
		totalItems: undefined
	};
	private cursors = new Map<EnvironmentID, ProgressivePaginationState>();
	private generation = 0;
	private listeners = new Set<() => void>();

	constructor(readonly pageSize: number = PaginationLoader.defaultPageSize) {}

	// MARK: - External store

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getSnapshot = () => this.state;

	private update(patch: Partial<EnvironmentPagedListSnapshot<Value>>) {
		const next = { ...this.state, ...patch };
		if (patch.items !== undefined) next.revision = this.state.revision + 1;
		next.showsAllEnvironments = next.environments.some((e) => e.name !== undefined);
		next.hasMore = [...this.cursors.values()].some((cursor) => cursor.hasMore);
		let total: number | undefined = 0;
		for (const environment of next.environments) {
			const count = this.cursors.get(environment.id)?.totalItems;
			if (count === undefined) {
				total = undefined;
				break;
			}
			total += count;
		}
		next.totalItems = total;
		this.state = next;
		for (const listener of this.listeners) listener();
	}

	// MARK: - Loading

	/**
	 * Loads the first page of every environment at once, publishing each
	 * environment's rows as they arrive. `preservingLoadedRange` refetches as
	 * many rows as each environment already shows (returning from a detail
	 * screen) instead of collapsing the list back to one page.
	 */
	async reload(
		environments: ListEnvironment[],
		fetch: EnvironmentFetch<Value>,
		options: { preservingLoadedRange?: boolean } = {}
	): Promise<void> {
		const request = ++this.generation;
		const previousCursors = this.cursors;
		const previousItems = new Map<EnvironmentID, EnvironmentItem<Value>[]>();
		for (const item of this.state.items) {
			const list = previousItems.get(item.environmentID) ?? [];
			list.push(item);
			previousItems.set(item.environmentID, list);
		}
		this.cursors = new Map();
		this.update({
			environments,
			isLoadingMore: false,
			isLoading: this.state.items.length === 0 ? true : this.state.isLoading,
			errorMessage: undefined,
			loadMoreError: undefined
		});

		const requests = environments.map((environment) => {
			const loaded = options.preservingLoadedRange
				? (previousCursors.get(environment.id)?.nextStart ?? 0)
				: 0;
			return { environment, start: 0, limit: Math.max(this.pageSize, loaded) };
		});
		const arrived = new Map<EnvironmentID, EnvironmentItem<Value>[]>();
		const failures: EnvironmentLoadFailure[] = [];
		let resolvedCount = 0;
		try {
			await progressiveFanOut(
				requests,
				(job) => fetchPage(job.environment, job.start, job.limit, fetch),
				(batch) => {
					if (request !== this.generation) return;
					for (const result of batch) {
						resolvedCount += 1;
						if (result.outcome.ok) {
							const page = result.outcome.page;
							const cursor = ProgressivePaginationState.receive(
								ProgressivePaginationState.initial,
								{
									pagination: page.pagination,
									itemCount: page.items.length,
									requestedStart: result.start,
									requestedLimit: result.limit,
									generation: 0
								}
							);
							if (cursor) this.cursors.set(result.environment.id, cursor);
							arrived.set(
								result.environment.id,
								page.items.map((item) => environmentItem(item, result.environment))
							);
						} else {
							if (isCancellation(result.outcome.error)) continue;
							// A failed environment keeps the rows it already showed, alongside its listed failure.
							arrived.set(result.environment.id, previousItems.get(result.environment.id) ?? []);
							failures.push({
								environment: result.environment,
								message: friendlyErrorMessage(result.outcome.error)
							});
						}
					}
					// Environments still loading keep their rows until they answer.
					const merged = environments.flatMap(
						(environment) => arrived.get(environment.id) ?? previousItems.get(environment.id) ?? []
					);
					const showsAll = environments.some((e) => e.name !== undefined);
					const allResolved = resolvedCount === requests.length;
					this.update({
						items: PaginationLoader.merge([], merged, true),
						failedEnvironments: showsAll ? [...failures] : [],
						errorMessage:
							allResolved && failures.length > 0 && failures.length === requests.length
								? failures[0]?.message
								: undefined,
						...([...arrived.values()].some((items) => items.length > 0) || allResolved
							? { isLoading: false }
							: {})
					});
				}
			);
		} finally {
			if (request === this.generation) this.update({ isLoading: false });
		}
	}

	async loadMore(fetch: EnvironmentFetch<Value>): Promise<void> {
		if (!this.state.hasMore || this.state.isLoadingMore) return;
		const request = this.generation;
		this.update({ isLoadingMore: true, loadMoreError: undefined });
		try {
			const pending = this.state.environments.flatMap((environment) => {
				const cursor = this.cursors.get(environment.id);
				return cursor?.hasMore ? [{ environment, start: cursor.nextStart }] : [];
			});
			const results = await Promise.all(
				pending.map((job) => fetchPage(job.environment, job.start, this.pageSize, fetch))
			);
			if (request !== this.generation) return;
			const incoming: EnvironmentItem<Value>[] = [];
			const failures: EnvironmentLoadFailure[] = [];
			for (const result of results) {
				if (result.outcome.ok) {
					const page = result.outcome.page;
					const current =
						this.cursors.get(result.environment.id) ?? ProgressivePaginationState.initial;
					const cursor = ProgressivePaginationState.receive(current, {
						pagination: page.pagination,
						itemCount: page.items.length,
						requestedStart: result.start,
						requestedLimit: result.limit,
						generation: current.generation
					});
					if (cursor) this.cursors.set(result.environment.id, cursor);
					incoming.push(...page.items.map((item) => environmentItem(item, result.environment)));
				} else {
					if (isCancellation(result.outcome.error)) continue;
					failures.push({
						environment: result.environment,
						message: friendlyErrorMessage(result.outcome.error)
					});
				}
			}
			this.update({
				items: PaginationLoader.merge(this.state.items, incoming, false),
				loadMoreError: failures[0]?.message
			});
		} finally {
			if (request === this.generation) this.update({ isLoadingMore: false });
		}
	}

	/** Local edits after an action, before the follow-up reload lands. */
	updateItems(body: (items: EnvironmentItem<Value>[]) => EnvironmentItem<Value>[]) {
		this.update({ items: body([...this.state.items]) });
	}
}

/** One `EnvironmentPagedList` per component, plus its live snapshot. */
export function useEnvironmentPagedList<Value extends Identifiable>(
	pageSize?: number
): [EnvironmentPagedList<Value>, EnvironmentPagedListSnapshot<Value>] {
	const ref = useRef<EnvironmentPagedList<Value> | null>(null);
	ref.current ??= new EnvironmentPagedList<Value>(pageSize);
	const list = ref.current;
	const snapshot = useSyncExternalStore(list.subscribe, list.getSnapshot);
	return [list, snapshot];
}

/** Pinned item IDs (see `EnvironmentItem.id`) for a list that may mix environments. */
export function pinnedEnvironmentItemIDs<Value extends Identifiable>(
	kind: PinnedItemKind,
	items: readonly EnvironmentItem<Value>[]
): Set<string> {
	const store = usePinnedItemsStore.getState();
	const byEnvironment = new Map<EnvironmentID, ReadonlySet<string>>();
	for (const environmentID of new Set(items.map((item) => item.environmentID))) {
		byEnvironment.set(environmentID, store.pinnedIDs(kind, environmentID));
	}
	return new Set(
		items
			.filter((item) => byEnvironment.get(item.environmentID)?.has(item.value.id))
			.map((item) => item.id)
	);
}

export function toggleEnvironmentItemPin<Value extends Identifiable>(
	item: EnvironmentItem<Value>,
	kind: PinnedItemKind
) {
	usePinnedItemsStore.getState().togglePin(item.value.id, kind, item.environmentID);
}
