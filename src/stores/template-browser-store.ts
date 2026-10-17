/**
 * Port of `TemplateBrowserStore.swift` (+ `TemplateSourceSelection`).
 *
 * Swift keeps one `@State` store per `TemplateBrowserView`, so this is a
 * factory: each browser screen creates its own store with
 * `createTemplateBrowserStore()` and reads it with `useStore`.
 */
import { createStore, type StoreApi } from 'zustand';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { PaginationLoader, ProgressivePaginationState } from '@/core/networking/pagination-loader';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { Template, TemplateSourceFilter } from '@/sdk/models/template/Template';

export type TemplateSourceSelection = 'all' | 'local' | 'remote';

export const TemplateSourceSelection = {
	allCases: ['all', 'local', 'remote'] as TemplateSourceSelection[],

	title(source: TemplateSourceSelection): string {
		switch (source) {
			case 'all':
				return 'All';
			case 'local':
				return 'Local';
			case 'remote':
				return 'Remote';
		}
	},

	icon(source: TemplateSourceSelection): string {
		switch (source) {
			case 'all':
				return 'square.grid.2x2';
			case 'local':
				return 'internaldrive';
			case 'remote':
				return 'cloud';
		}
	},

	sdkFilter(source: TemplateSourceSelection): TemplateSourceFilter {
		return source;
	}
} as const;

const pageSize = 30;

export type TemplateBrowserState = {
	templates: Template[];
	isLoading: boolean;
	isLoadingMore: boolean;
	hasMore: boolean;
	totalItemCount: number | undefined;
	errorMessage: string | undefined;
	loadMoreError: string | undefined;

	searchText: string;
	source: TemplateSourceSelection;

	setSearchText: (text: string) => void;
	setSource: (source: TemplateSourceSelection) => void;
	configure: (client: ArcaneClient | undefined) => void;
	reload: (options?: { clearExisting?: boolean }) => Promise<void>;
	loadMore: () => Promise<void>;
};

/** `queryKey`: trimmed search + source, e.g. `"|all"` for the unfiltered list. */
export function templateBrowserQueryKey(
	state: Pick<TemplateBrowserState, 'searchText' | 'source'>
): string {
	return `${state.searchText.trim()}|${state.source}`;
}

export type TemplateBrowserStore = StoreApi<TemplateBrowserState>;

export function createTemplateBrowserStore(): TemplateBrowserStore {
	return createStore<TemplateBrowserState>((set, get) => {
		let client: ArcaneClient | undefined;
		let clientTransportIdentity: object | undefined;
		let pagination = ProgressivePaginationState.initial;

		const normalizedSearch = () => {
			const value = get().searchText.trim();
			return value === '' ? undefined : value;
		};

		const fetchPage = (start: number) => {
			const current = client;
			if (!current) throw new Error('No client');
			return current.templates.listPaginated({
				search: normalizedSearch(),
				sort: 'name',
				order: 'asc',
				start,
				limit: pageSize,
				source: TemplateSourceSelection.sdkFilter(get().source)
			});
		};

		return {
			templates: [],
			isLoading: false,
			isLoadingMore: false,
			hasMore: false,
			totalItemCount: undefined,
			errorMessage: undefined,
			loadMoreError: undefined,
			searchText: '',
			source: 'all',

			setSearchText: (searchText) => set({ searchText }),
			setSource: (source) => set({ source }),

			configure: (next) => {
				const nextIdentity = next?.transport;
				if (nextIdentity === clientTransportIdentity) {
					client = next;
					return;
				}
				client = next;
				clientTransportIdentity = nextIdentity;
				pagination = ProgressivePaginationState.reset(pagination);
				set({
					isLoading: false,
					isLoadingMore: false,
					templates: [],
					hasMore: false,
					totalItemCount: undefined,
					errorMessage: undefined,
					loadMoreError: undefined
				});
			},

			reload: async ({ clearExisting = false } = {}) => {
				if (!client) return;
				const requestedQuery = templateBrowserQueryKey(get());
				pagination = ProgressivePaginationState.reset(pagination);
				const generation = pagination.generation;
				set({
					isLoadingMore: false,
					hasMore: false,
					totalItemCount: undefined,
					...(clearExisting ? { templates: [] } : {}),
					isLoading: true,
					errorMessage: undefined,
					loadMoreError: undefined
				});
				const accepted = () =>
					ProgressivePaginationState.accepts(pagination, generation) &&
					requestedQuery === templateBrowserQueryKey(get());
				try {
					const response = await fetchPage(0);
					if (!accepted()) return;
					const received = ProgressivePaginationState.receive(pagination, {
						pagination: response.pagination,
						itemCount: response.data.length,
						requestedStart: 0,
						requestedLimit: pageSize,
						generation
					});
					if (received) pagination = received;
					set({
						templates: PaginationLoader.merge([], response.data, true),
						hasMore: pagination.hasMore,
						totalItemCount: pagination.totalItems,
						errorMessage: undefined,
						loadMoreError: undefined
					});
				} catch (error) {
					if (isCancellation(error) || !accepted()) return;
					set({ errorMessage: friendlyErrorMessage(error) });
				} finally {
					if (ProgressivePaginationState.accepts(pagination, generation)) set({ isLoading: false });
				}
			},

			loadMore: async () => {
				const state = get();
				if (!client || !state.hasMore || state.isLoading || state.isLoadingMore) return;
				const requestedQuery = templateBrowserQueryKey(state);
				const generation = pagination.generation;
				const start = pagination.nextStart;
				set({ loadMoreError: undefined, isLoadingMore: true });
				const accepted = () =>
					ProgressivePaginationState.accepts(pagination, generation) &&
					requestedQuery === templateBrowserQueryKey(get());
				try {
					const response = await fetchPage(start);
					if (!accepted()) return;
					const received = ProgressivePaginationState.receive(pagination, {
						pagination: response.pagination,
						itemCount: response.data.length,
						requestedStart: start,
						requestedLimit: pageSize,
						generation
					});
					if (received) pagination = received;
					set({
						templates: PaginationLoader.merge(get().templates, response.data, false),
						hasMore: pagination.hasMore,
						totalItemCount: pagination.totalItems,
						loadMoreError: undefined
					});
				} catch (error) {
					if (isCancellation(error) || !accepted()) return;
					set({ loadMoreError: friendlyErrorMessage(error) });
				} finally {
					if (ProgressivePaginationState.accepts(pagination, generation))
						set({ isLoadingMore: false });
				}
			}
		};
	});
}
