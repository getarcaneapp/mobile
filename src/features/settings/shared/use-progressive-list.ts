/**
 * The progressive-pagination list state the Settings resource lists share
 * (UsersView / RolesView): `ProgressivePaginationState` + `PaginationLoader.merge`,
 * first-page reload with generation guards, and `loadMore` for the
 * `PaginatedListFooter`. Platform-neutral.
 */
import { useCallback, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import {
	PaginationLoader,
	ProgressivePaginationState,
	type Identifiable
} from '@/core/networking/pagination-loader';
import type { PaginatedResponse } from '@/sdk/pagination/PaginatedResponse';

export type ProgressivePageFetch<Item> = (
	search: string | undefined,
	start: number,
	limit: number
) => Promise<PaginatedResponse<Item>>;

export function useProgressiveList<Item extends Identifiable>({
	pageSize,
	search,
	fetchPage,
	beforeFirstPage
}: {
	pageSize: number;
	/** The debounced search text; empty means no `search` query. */
	search: string;
	/** Undefined when the list can't load (no client, feature unavailable): `guard … else { return }`. */
	fetchPage: ProgressivePageFetch<Item> | undefined;
	/** Extra work joined with the first page (`async let`), e.g. RolesView's permission manifest. */
	beforeFirstPage?: () => Promise<void>;
}) {
	const [items, setItemsState] = useState<Item[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [isLoadingMore, setIsLoadingMoreState] = useState(false);
	const [loadMoreError, setLoadMoreError] = useState<string>();
	const [pagination, setPaginationState] = useState(ProgressivePaginationState.initial);

	const itemsRef = useRef(items);
	const paginationRef = useRef(pagination);
	const loadingMoreRef = useRef(false);
	const latest = useRef({ search, fetchPage, beforeFirstPage });
	latest.current = { search, fetchPage, beforeFirstPage };

	const setItems = useCallback((next: Item[]) => {
		itemsRef.current = next;
		setItemsState(next);
	}, []);
	const setPagination = (next: ProgressivePaginationState) => {
		paginationRef.current = next;
		setPaginationState(next);
	};
	const setIsLoadingMore = (value: boolean) => {
		loadingMoreRef.current = value;
		setIsLoadingMoreState(value);
	};

	const applyPage = (
		response: PaginatedResponse<Item>,
		reset: boolean,
		requestedStart: number,
		generation: number
	) => {
		const next = ProgressivePaginationState.receive(paginationRef.current, {
			pagination: response.pagination,
			itemCount: response.data.length,
			requestedStart,
			requestedLimit: pageSize,
			generation
		});
		if (!next) return;
		setPagination(next);
		setItems(PaginationLoader.merge(itemsRef.current, response.data, reset));
		setLoadMoreError(undefined);
	};

	const query = () => (latest.current.search === '' ? undefined : latest.current.search);

	const load = useCallback(async () => {
		const fetch = latest.current.fetchPage;
		if (!fetch) return;
		const reset = ProgressivePaginationState.reset(paginationRef.current);
		setPagination(reset);
		const generation = reset.generation;
		setIsLoadingMore(false);
		if (itemsRef.current.length === 0) setIsLoading(true);
		setErrorMessage(undefined);
		setLoadMoreError(undefined);
		try {
			const [response] = await Promise.all([
				fetch(query(), 0, pageSize),
				latest.current.beforeFirstPage?.()
			]);
			applyPage(response, true, 0, generation);
		} catch (error) {
			if (!ProgressivePaginationState.accepts(paginationRef.current, generation)) return;
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (ProgressivePaginationState.accepts(paginationRef.current, generation))
				setIsLoading(false);
		}
	}, [pageSize]);

	const loadMore = useCallback(async () => {
		const fetch = latest.current.fetchPage;
		const state = paginationRef.current;
		if (!state.hasMore || loadingMoreRef.current || !fetch) return;
		setIsLoadingMore(true);
		setLoadMoreError(undefined);
		const generation = state.generation;
		const start = state.nextStart;
		try {
			const response = await fetch(query(), start, pageSize);
			applyPage(response, false, start, generation);
		} catch (error) {
			if (!ProgressivePaginationState.accepts(paginationRef.current, generation)) return;
			setLoadMoreError(friendlyErrorMessage(error));
		} finally {
			if (ProgressivePaginationState.accepts(paginationRef.current, generation))
				setIsLoadingMore(false);
		}
	}, [pageSize]);

	const removeItem = useCallback(
		(id: string) => setItems(itemsRef.current.filter((item) => item.id !== id)),
		[setItems]
	);

	return {
		items,
		isLoading,
		errorMessage,
		isLoadingMore,
		loadMoreError,
		hasMore: pagination.hasMore,
		totalItems: pagination.totalItems,
		load,
		loadMore,
		removeItem
	};
}
