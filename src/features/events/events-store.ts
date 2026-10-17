import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { PaginationLoader, ProgressivePaginationState } from '@/core/networking/pagination-loader';
import type { ArcaneClient } from '@/sdk';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import { parseArcaneDate } from '@/sdk/models/base/date';
import type { Event, EventSeverityCounts } from '@/sdk/models/event/Event';

export type EventSeverityFilter = 'info' | 'success' | 'warning' | 'error';

export const EventSeverityFilter = {
	allCases: ['info', 'success', 'warning', 'error'] as const,
	title: { info: 'Info', success: 'Success', warning: 'Warning', error: 'Error' } as Record<
		EventSeverityFilter,
		string
	>,
	icon: {
		info: 'info.circle.fill',
		success: 'checkmark.circle.fill',
		warning: 'exclamationmark.triangle.fill',
		error: 'xmark.octagon.fill'
	} as Record<EventSeverityFilter, string>
};

const timestampMs = (event: Event) => parseArcaneDate(event.timestamp)?.getTime() ?? 0;

export function mergedEventHistory(current: Event[], incoming: Event[], limit: number): Event[] {
	if (limit <= 0) return [];
	const byID = new Map<string, Event>();
	for (const event of current) byID.set(event.id, event);
	for (const event of incoming) byID.set(event.id, event);
	return [...byID.values()]
		.sort((a, b) => {
			const ta = timestampMs(a);
			const tb = timestampMs(b);
			if (ta === tb) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
			return tb - ta;
		})
		.slice(0, limit);
}

function sameEvents(a: Event[], b: Event[]) {
	if (a.length !== b.length) return false;
	return a.every((event, index) => {
		const other = b[index];
		return other !== undefined && JSON.stringify(event) === JSON.stringify(other);
	});
}

function sameCounts(a: EventSeverityCounts | undefined, b: EventSeverityCounts | undefined) {
	if (!a || !b) return a === b;
	return (
		a.total === b.total &&
		a.info === b.info &&
		a.success === b.success &&
		a.warning === b.warning &&
		a.error === b.error
	);
}

export type EventsSnapshot = {
	events: Event[];
	severityCounts?: EventSeverityCounts;
	supportsSeverityCounts: boolean;
	isLoading: boolean;
	isLoadingMore: boolean;
	deletingEventIDs: ReadonlySet<string>;
	hasMore: boolean;
	totalItemCount?: number;
	errorMessage?: string;
	loadMoreError?: string;
	searchText: string;
	selectedSeverities: ReadonlySet<EventSeverityFilter>;
};

export class EventsStore {
	static readonly pageSize = 50;

	private state: EventsSnapshot = {
		events: [],
		supportsSeverityCounts: true,
		isLoading: false,
		isLoadingMore: false,
		deletingEventIDs: new Set(),
		hasMore: false,
		searchText: '',
		selectedSeverities: new Set()
	};
	private listeners = new Set<() => void>();
	private client: ArcaneClient | undefined;
	private pagination: ProgressivePaginationState = ProgressivePaginationState.initial;

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getSnapshot = () => this.state;

	private set(patch: Partial<EventsSnapshot>) {
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener();
	}

	get queryKey(): string {
		const severities = [...this.state.selectedSeverities].sort().join(',');
		return `${this.state.searchText.trim()}|${severities}`;
	}

	private get normalizedSearch() {
		const value = this.state.searchText.trim();
		return value === '' ? undefined : value;
	}

	private get encodedSeverities() {
		const value = [...this.state.selectedSeverities].sort().join(',');
		return value === '' ? undefined : value;
	}

	private resetPagination() {
		this.pagination = ProgressivePaginationState.reset(this.pagination);
		return this.pagination.generation;
	}

	configure(client: ArcaneClient | undefined) {
		if (client === this.client) return;
		this.client = client;
		this.resetPagination();
		this.set({
			isLoading: false,
			isLoadingMore: false,
			events: [],
			severityCounts: undefined,
			supportsSeverityCounts: true,
			deletingEventIDs: new Set(),
			hasMore: false,
			totalItemCount: undefined,
			errorMessage: undefined,
			loadMoreError: undefined
		});
	}

	setSearchText(searchText: string) {
		this.set({ searchText });
	}

	private list(start: number) {
		return this.client!.events.listPaginated({
			search: this.normalizedSearch,
			sort: 'timestamp',
			order: 'desc',
			start,
			limit: EventsStore.pageSize,
			severity: this.encodedSeverities
		});
	}

	private receive(pagination: Parameters<typeof ProgressivePaginationState.receive>[1]) {
		const next = ProgressivePaginationState.receive(this.pagination, pagination);
		if (next) this.pagination = next;
	}

	async reload(clearExisting = false) {
		if (!this.client) return;
		const requestedQuery = this.queryKey;
		const generation = this.resetPagination();
		this.set({
			isLoadingMore: false,
			hasMore: false,
			totalItemCount: undefined,
			...(clearExisting ? { events: [] } : {}),
			isLoading: true,
			errorMessage: undefined,
			loadMoreError: undefined
		});
		try {
			const response = await this.list(0);
			if (
				!ProgressivePaginationState.accepts(this.pagination, generation) ||
				requestedQuery !== this.queryKey
			)
				return;
			const events = PaginationLoader.merge([], response.data, true);
			this.receive({
				pagination: response.pagination,
				itemCount: response.data.length,
				requestedStart: 0,
				requestedLimit: EventsStore.pageSize,
				generation
			});
			this.set({
				events,
				hasMore: this.pagination.hasMore,
				totalItemCount: this.pagination.totalItems,
				errorMessage: undefined
			});
		} catch (error) {
			if (isCancellation(error)) return;
			if (
				!ProgressivePaginationState.accepts(this.pagination, generation) ||
				requestedQuery !== this.queryKey
			)
				return;
			this.set({ errorMessage: friendlyErrorMessage(error) });
		} finally {
			if (ProgressivePaginationState.accepts(this.pagination, generation))
				this.set({ isLoading: false });
		}
	}

	async loadMore() {
		const { hasMore, isLoading, isLoadingMore } = this.state;
		if (!this.client || !hasMore || isLoading || isLoadingMore) return;
		const requestedQuery = this.queryKey;
		const generation = this.pagination.generation;
		const start = this.pagination.nextStart;
		this.set({ isLoadingMore: true, loadMoreError: undefined });
		try {
			const response = await this.list(start);
			if (
				!ProgressivePaginationState.accepts(this.pagination, generation) ||
				requestedQuery !== this.queryKey
			)
				return;
			const events = PaginationLoader.merge(this.state.events, response.data, false);
			this.receive({
				pagination: response.pagination,
				itemCount: response.data.length,
				requestedStart: start,
				requestedLimit: EventsStore.pageSize,
				generation
			});
			this.set({
				events,
				hasMore: this.pagination.hasMore,
				totalItemCount: this.pagination.totalItems,
				loadMoreError: undefined
			});
		} catch (error) {
			if (isCancellation(error)) return;
			if (
				!ProgressivePaginationState.accepts(this.pagination, generation) ||
				requestedQuery !== this.queryKey
			)
				return;
			this.set({ loadMoreError: friendlyErrorMessage(error) });
		} finally {
			if (ProgressivePaginationState.accepts(this.pagination, generation))
				this.set({ isLoadingMore: false });
		}
	}

	async loadSeverityCounts() {
		const client = this.client;
		if (!this.state.supportsSeverityCounts || !client) return;
		try {
			const counts = await client.events.stats();
			if (client !== this.client) return;
			if (!sameCounts(counts, this.state.severityCounts)) this.set({ severityCounts: counts });
		} catch (error) {
			if (isArcaneError(error, 'notFound')) {
				if (client !== this.client) return;
				this.set({ supportsSeverityCounts: false, severityCounts: undefined });
			}
		}
	}

	async poll() {
		if (!this.client || this.state.isLoading || this.state.isLoadingMore) return;
		const requestedQuery = this.queryKey;
		const generation = this.pagination.generation;
		try {
			const response = await this.list(0);
			const { isLoading, isLoadingMore, events, hasMore, totalItemCount, errorMessage } =
				this.state;
			if (
				!ProgressivePaginationState.accepts(this.pagination, generation) ||
				requestedQuery !== this.queryKey ||
				isLoading ||
				isLoadingMore
			) {
				return;
			}
			const patch: Partial<EventsSnapshot> = {};
			const merged = mergedEventHistory(
				events,
				response.data,
				Math.max(EventsStore.pageSize, events.length)
			);
			if (!sameEvents(merged, events)) patch.events = merged;
			if (response.pagination.totalItems >= 0) {
				const nextHasMore = this.pagination.nextStart < response.pagination.totalItems;
				if (nextHasMore !== hasMore) patch.hasMore = nextHasMore;
				if (totalItemCount !== response.pagination.totalItems)
					patch.totalItemCount = response.pagination.totalItems;
			}
			if (errorMessage !== undefined) patch.errorMessage = undefined;
			if (Object.keys(patch).length > 0) this.set(patch);
		} catch (error) {
			if (isCancellation(error)) return;
			if (
				!ProgressivePaginationState.accepts(this.pagination, generation) ||
				requestedQuery !== this.queryKey
			)
				return;
			if (this.state.events.length === 0) this.set({ errorMessage: friendlyErrorMessage(error) });
		}
	}

	async delete(event: Event) {
		if (!this.client) return;
		this.set({ deletingEventIDs: new Set([...this.state.deletingEventIDs, event.id]) });
		try {
			await this.client.events.delete({ id: event.id });
			this.set({ events: this.state.events.filter((e) => e.id !== event.id) });
			await this.loadSeverityCounts();
		} finally {
			const ids = new Set(this.state.deletingEventIDs);
			ids.delete(event.id);
			this.set({ deletingEventIDs: ids });
		}
	}

	toggle = (severity: EventSeverityFilter) => {
		const next = new Set(this.state.selectedSeverities);
		if (next.has(severity)) next.delete(severity);
		else next.add(severity);
		this.set({ selectedSeverities: next });
	};

	clearSeverities = () => {
		this.set({ selectedSeverities: new Set() });
	};
}
