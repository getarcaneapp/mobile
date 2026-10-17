/**
 * Data loading of `UpdaterHistoryView` (UpdaterHistoryView.swift): grows the
 * `limit` by a page at a time and filters locally by a debounced search.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { AutoUpdateRecord } from '@/sdk/models/updater/Updater';
import { useClientManager } from '@/stores/client-manager';

import { containsInsensitive } from './updates-logic';

const pageSize = 50;

export function useUpdaterHistory(environmentID: EnvironmentID) {
	const client = useClientManager((s) => s.client);
	const [records, setRecords] = useState<AutoUpdateRecord[]>([]);
	const [limit, setLimit] = useState(pageSize);
	const [hasMore, setHasMore] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [loadMoreError, setLoadMoreError] = useState<string>();
	const [searchText, setSearchText] = useState('');
	const [debouncedSearchText, setDebouncedSearchText] = useState('');

	const state = useRef({ records, limit, hasMore, isLoading, isLoadingMore });
	state.current = { records, limit, hasMore, isLoading, isLoadingMore };

	// `.debounce(searchText, for: .milliseconds(200), into: $debouncedSearchText)`
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearchText(searchText), 200);
		return () => clearTimeout(timer);
	}, [searchText]);

	const displayedRecords = useMemo(() => {
		const trimmed = debouncedSearchText.trim();
		if (trimmed === '') return records;
		return records.filter(
			(record) =>
				containsInsensitive(record.resourceName, trimmed) ||
				containsInsensitive(record.resourceType, trimmed) ||
				containsInsensitive(record.status, trimmed)
		);
	}, [records, debouncedSearchText]);

	const load = useCallback(
		async (refresh = false) => {
			const activeClient = useClientManager.getState().client;
			if (!activeClient) return;
			if (state.current.records.length === 0) setIsLoading(true);
			let requestLimit = state.current.limit;
			if (refresh) {
				requestLimit = pageSize;
				setLimit(pageSize);
				setErrorMessage(undefined);
			}
			try {
				const fetched = await activeClient.updater.history({
					limit: requestLimit,
					envID: environmentID
				});
				setRecords(fetched);
				setHasMore(fetched.length >= requestLimit);
				setErrorMessage(undefined);
			} catch (error) {
				setErrorMessage(friendlyErrorMessage(error));
			} finally {
				setIsLoading(false);
			}
		},
		[environmentID]
	);

	const loadMore = useCallback(async () => {
		const activeClient = useClientManager.getState().client;
		const current = state.current;
		if (!activeClient || !current.hasMore || current.isLoading || current.isLoadingMore) return;
		setLoadMoreError(undefined);
		setIsLoadingMore(true);
		const newLimit = current.limit + pageSize;
		try {
			const fetched = await activeClient.updater.history({ limit: newLimit, envID: environmentID });
			setRecords(fetched);
			setLimit(newLimit);
			setHasMore(fetched.length >= newLimit);
		} catch (error) {
			setLoadMoreError(friendlyErrorMessage(error));
		} finally {
			setIsLoadingMore(false);
		}
	}, [environmentID]);

	useEffect(() => {
		void load();
	}, [load, client]);

	return {
		records,
		displayedRecords,
		hasMore,
		isLoading,
		errorMessage,
		loadMoreError,
		searchText,
		setSearchText,
		load,
		loadMore
	};
}
