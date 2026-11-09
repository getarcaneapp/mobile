import { useState, useSyncExternalStore } from 'react';

import { deepEqual } from '@/core/deep-equal';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import {
	environmentSources,
	singleEnvironmentSources,
	type EnvironmentSource
} from '@/core/networking/environment-sources';
import {
	PaginationLoader,
	ProgressivePaginationState,
	progressiveFanOut,
	type Identifiable,
	type ResourcePage
} from '@/core/networking/pagination-loader';
import type { EnvironmentID } from '@/sdk/client/environment';
import { ItemEnvironment } from '@/sdk/pagination/PaginatedResponse';
import { useClientManager } from '@/stores/client-manager';
import type { ListEnvironment } from '@/stores/environments-store';
import { reusingUnchanged } from '@/stores/environment-item-identity';
import { usePinnedItemsStore, type PinnedItemKind } from '@/stores/pinned-items-store';

export interface EnvironmentItem<Value extends Identifiable> {
	environmentID: EnvironmentID;
	environmentName?: string;
	value: Value;
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
	environmentID: string,
	start: number,
	limit: number
) => Promise<ResourcePage<Value>>;

type PageResult<Value> = {
	source: Source;
	start: number;
	limit: number;
	outcome: { ok: true; page: ResourcePage<Value> } | { ok: false; error: unknown };
};

type Source = EnvironmentSource<ListEnvironment>;

export interface EnvironmentPagedListSnapshot<Value extends Identifiable> {
	items: EnvironmentItem<Value>[];
	revision: number;
	environments: ListEnvironment[];
	isLoading: boolean;
	isLoadingMore: boolean;
	errorMessage: string | undefined;
	loadMoreError: string | undefined;
	failedEnvironments: EnvironmentLoadFailure[];
	showsAllEnvironments: boolean;
	hasMore: boolean;
	totalItems: number | undefined;
}

function sameSnapshot<Value extends Identifiable>(
	a: EnvironmentPagedListSnapshot<Value>,
	b: EnvironmentPagedListSnapshot<Value>
): boolean {
	return (
		a.items === b.items &&
		a.environments === b.environments &&
		a.isLoading === b.isLoading &&
		a.isLoadingMore === b.isLoadingMore &&
		a.errorMessage === b.errorMessage &&
		a.loadMoreError === b.loadMoreError &&
		a.failedEnvironments === b.failedEnvironments &&
		a.showsAllEnvironments === b.showsAllEnvironments &&
		a.hasMore === b.hasMore &&
		a.totalItems === b.totalItems
	);
}

async function fetchPage<Value>(
	source: Source,
	start: number,
	limit: number,
	fetch: EnvironmentFetch<Value>
): Promise<PageResult<Value>> {
	try {
		return {
			source,
			start,
			limit,
			outcome: { ok: true, page: await fetch(source.key, start, limit) }
		};
	} catch (error) {
		return { source, start, limit, outcome: { ok: false, error } };
	}
}

function sourcePage<Value extends Identifiable>(
	source: Source,
	page: ResourcePage<Value>
): { items: EnvironmentItem<Value>[]; failures: EnvironmentLoadFailure[] } {
	const [only] = source.environments;
	if (source.environments.length === 1 && only)
		return { items: page.items.map((item) => environmentItem(item, only)), failures: [] };
	const byID = new Map(source.environments.map((environment) => [environment.id, environment]));
	const items = page.items.flatMap((item) => {
		const environment = byID.get(ItemEnvironment.get(item)?.id ?? '');
		return environment ? [environmentItem(item, environment)] : [];
	});
	const failures = (page.failedEnvironments ?? []).flatMap((failure) => {
		const environment = byID.get(failure.environment.id);
		return environment
			? [{ environment, message: failure.message || 'Environment unavailable' }]
			: [];
	});
	return { items, failures };
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
	private sources: Source[] = [];
	private cursors = new Map<string, ProgressivePaginationState>();
	private generation = 0;
	private listeners = new Set<() => void>();

	constructor(readonly pageSize: number = PaginationLoader.defaultPageSize) {}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getSnapshot = () => this.state;

	private update(patch: Partial<EnvironmentPagedListSnapshot<Value>>) {
		const next = { ...this.state, ...patch };
		if (patch.items !== undefined && patch.items !== this.state.items)
			next.revision = this.state.revision + 1;
		next.showsAllEnvironments = next.environments.some((e) => e.name !== undefined);
		next.hasMore = [...this.cursors.values()].some((cursor) => cursor.hasMore);
		let total: number | undefined = 0;
		for (const source of this.sources) {
			const count = this.cursors.get(source.key)?.totalItems;
			if (count === undefined) {
				total = undefined;
				break;
			}
			total += count;
		}
		next.totalItems = total;
		if (sameSnapshot(this.state, next)) return;
		this.state = next;
		for (const listener of this.listeners) listener();
	}

	async reload(
		environments: ListEnvironment[],
		fetch: EnvironmentFetch<Value>,
		options: { preservingLoadedRange?: boolean; aggregates?: boolean } = {}
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
		this.sources = singleEnvironmentSources(environments);
		this.update({
			environments,
			isLoadingMore: false,
			isLoading: this.state.items.length === 0 ? true : this.state.isLoading,
			errorMessage: undefined,
			loadMoreError: undefined
		});

		const sources = options.aggregates
			? await environmentSources(useClientManager.getState().client, environments)
			: this.sources;
		if (request !== this.generation) return;
		this.sources = sources;
		const previousOf = (source: Source) =>
			source.environments.flatMap((environment) => previousItems.get(environment.id) ?? []);

		const requests = sources.map((source) => {
			const loaded = options.preservingLoadedRange
				? (previousCursors.get(source.key)?.nextStart ?? 0)
				: 0;
			return { source, start: 0, limit: Math.max(this.pageSize, loaded) };
		});
		const arrived = new Map<string, EnvironmentItem<Value>[]>();
		const failures: EnvironmentLoadFailure[] = [];
		let resolvedCount = 0;
		try {
			await progressiveFanOut(
				requests,
				(job) => fetchPage(job.source, job.start, job.limit, fetch),
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
							if (cursor) this.cursors.set(result.source.key, cursor);
							const loaded = sourcePage(result.source, page);
							failures.push(...loaded.failures);
							arrived.set(result.source.key, [
								...loaded.items,
								...loaded.failures.flatMap(
									(failure) => previousItems.get(failure.environment.id) ?? []
								)
							]);
						} else {
							if (isCancellation(result.outcome.error)) continue;
							arrived.set(result.source.key, previousOf(result.source));
							const message = friendlyErrorMessage(result.outcome.error);
							for (const environment of result.source.environments)
								failures.push({ environment, message });
						}
					}
					const merged = sources.flatMap((source) => arrived.get(source.key) ?? previousOf(source));
					const showsAll = environments.some((e) => e.name !== undefined);
					const allResolved = resolvedCount === requests.length;
					const nextFailures = showsAll ? failures : [];
					this.update({
						items: reusingUnchanged(this.state.items, PaginationLoader.merge([], merged, true)),
						failedEnvironments: deepEqual(this.state.failedEnvironments, nextFailures)
							? this.state.failedEnvironments
							: [...nextFailures],
						errorMessage:
							allResolved && failures.length > 0 && failures.length >= environments.length
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
			const pending = this.sources.flatMap((source) => {
				const cursor = this.cursors.get(source.key);
				return cursor?.hasMore ? [{ source, start: cursor.nextStart }] : [];
			});
			const results = await Promise.all(
				pending.map((job) => fetchPage(job.source, job.start, this.pageSize, fetch))
			);
			if (request !== this.generation) return;
			const incoming: EnvironmentItem<Value>[] = [];
			const failures: string[] = [];
			for (const result of results) {
				if (result.outcome.ok) {
					const page = result.outcome.page;
					const current = this.cursors.get(result.source.key) ?? ProgressivePaginationState.initial;
					const cursor = ProgressivePaginationState.receive(current, {
						pagination: page.pagination,
						itemCount: page.items.length,
						requestedStart: result.start,
						requestedLimit: result.limit,
						generation: current.generation
					});
					if (cursor) this.cursors.set(result.source.key, cursor);
					incoming.push(...sourcePage(result.source, page).items);
				} else {
					if (isCancellation(result.outcome.error)) continue;
					failures.push(friendlyErrorMessage(result.outcome.error));
				}
			}
			this.update({
				items: PaginationLoader.merge(this.state.items, incoming, false),
				loadMoreError: failures[0],
				isLoadingMore: false
			});
		} finally {
			if (request === this.generation) this.update({ isLoadingMore: false });
		}
	}

	updateItems(body: (items: EnvironmentItem<Value>[]) => EnvironmentItem<Value>[]) {
		this.update({ items: body([...this.state.items]) });
	}
}

export function useEnvironmentPagedList<Value extends Identifiable>(
	pageSize?: number
): [EnvironmentPagedList<Value>, EnvironmentPagedListSnapshot<Value>] {
	const [list] = useState(() => new EnvironmentPagedList<Value>(pageSize));
	const snapshot = useSyncExternalStore(list.subscribe, list.getSnapshot);
	return [list, snapshot];
}

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
