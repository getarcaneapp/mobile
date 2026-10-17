/**
 * `APIKeysView` model (APIKeysView.swift): paginated, searchable, sortable
 * API-key list with owner lookup, create sheet, and one-time key reveal.
 */
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { PaginationLoader, ProgressivePaginationState } from '@/core/networking/pagination-loader';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { APIKey } from '@/sdk/models/apiKey/APIKey';
import { SortOrder } from '@/sdk/models/base/pagination';
import type { User } from '@/sdk/models/user/User';
import type { PaginatedResponse } from '@/sdk/pagination/PaginatedResponse';
import { useClientManager } from '@/stores/client-manager';
import { ListUX } from '@/ui/components/paginated-list.types';
import { showToast, Toasts } from '@/ui/toast';
import { useDebounced, useOnChange } from '@/features/containers/hooks';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';
import { useAPIKeyAccess } from './api-key-access';
import {
	APIKeySecretPresentation,
	invalidateAPIKeyCache,
	type APIKeyDetailPayload,
	type APIKeySecretPayload,
	type APIKeySortField,
	type CreateAPIKeyPayload
} from './api-key-models';

const pageSize = 50;

async function fetchAssignedUsers(client: ArcaneClient, enabled: boolean): Promise<User[]> {
	if (!enabled) return [];
	try {
		return await PaginationLoader.collect(async (start, limit) => {
			const response = await client.users.listPaginated({ start, limit });
			return { items: response.data, pagination: response.pagination };
		});
	} catch {
		// API-key access and user-list access are separate v2 permissions.
		// Keep the keys usable even when owner profiles cannot be fetched.
		return [];
	}
}

/**
 * Presents the one-time secret sheet (Swift `.sheet(item: $revealedKey)`).
 * A presentation requested while another sheet is still on top waits until
 * this screen is focused again, like SwiftUI presenting after the create
 * sheet dismisses. `onDismissed` is the sheet's `onDismiss`.
 */
export function useSecretPresentation(onDismissed?: () => void) {
	const navigation = useSettingsNavigation();
	const pending = useRef<APIKeySecretPresentation | undefined>(undefined);
	const presented = useRef(false);
	const isFocused = useRef(false);
	const latestDismissed = useRef(onDismissed);
	latestDismissed.current = onDismissed;

	const presentPending = useCallback(() => {
		const presentation = pending.current;
		if (!presentation || !isFocused.current) return;
		pending.current = undefined;
		presented.current = true;
		const payload: APIKeySecretPayload = { presentation };
		navigation.push('settings/api-keys/secret', { token: settingsPayloads.put(payload) });
	}, [navigation]);

	useFocusEffect(
		useCallback(() => {
			isFocused.current = true;
			if (presented.current) {
				presented.current = false;
				latestDismissed.current?.();
			}
			// Let a dismissing sheet finish before presenting the next one.
			const timer = setTimeout(presentPending, 350);
			return () => {
				isFocused.current = false;
				clearTimeout(timer);
			};
		}, [presentPending])
	);

	return useCallback(
		(presentation: APIKeySecretPresentation) => {
			pending.current = presentation;
			presentPending();
		},
		[presentPending]
	);
}

export function useAPIKeys() {
	const navigation = useSettingsNavigation();
	const access = useAPIKeyAccess();
	const client = useClientManager((s) => s.client);
	const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
	const [assignedUsers, setAssignedUsers] = useState<Map<string, User>>(new Map());
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [searchText, setSearchText] = useState('');
	const debouncedSearchText = useDebounced(searchText, ListUX.searchDebounce);
	const [sortField, setSortField] = useState<APIKeySortField>('name');
	const [sortOrder, setSortOrder] = useState<SortOrder>(SortOrder.ascending);
	const [pagination, setPagination] = useState(ProgressivePaginationState.initial);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [loadMoreError, setLoadMoreError] = useState<string>();

	// Async continuations read the latest values (Swift reads `@State` live).
	const paginationRef = useRef(pagination);
	const apiKeysRef = useRef(apiKeys);
	const isLoadingMoreRef = useRef(false);
	const query = useRef({
		search: debouncedSearchText,
		sort: sortField,
		order: sortOrder,
		canListUsers: access.canListUsers
	});
	query.current = {
		search: debouncedSearchText,
		sort: sortField,
		order: sortOrder,
		canListUsers: access.canListUsers
	};

	const updatePagination = (next: ProgressivePaginationState) => {
		paginationRef.current = next;
		setPagination(next);
	};
	const updateKeys = (next: APIKey[]) => {
		apiKeysRef.current = next;
		setApiKeys(next);
	};
	const setLoadingMore = (value: boolean) => {
		isLoadingMoreRef.current = value;
		setIsLoadingMore(value);
	};

	const applyPage = (
		response: PaginatedResponse<APIKey>,
		reset: boolean,
		requestedStart: number,
		generation: number
	): boolean => {
		const next = ProgressivePaginationState.receive(paginationRef.current, {
			pagination: response.pagination,
			itemCount: response.data.length,
			requestedStart,
			requestedLimit: pageSize,
			generation
		});
		if (!next) return false;
		updatePagination(next);
		updateKeys(PaginationLoader.merge(apiKeysRef.current, response.data, reset));
		setLoadMoreError(undefined);
		setErrorMessage(undefined);
		return true;
	};

	const loadKeys = async () => {
		const current = useClientManager.getState().client;
		if (!current) return;
		const reset = ProgressivePaginationState.reset(paginationRef.current);
		updatePagination(reset);
		const generation = reset.generation;
		const { search, sort, order, canListUsers } = query.current;
		setLoadingMore(false);
		if (apiKeysRef.current.length === 0) setIsLoading(true);
		setErrorMessage(undefined);
		setLoadMoreError(undefined);
		try {
			const pageTask = current.apiKeys.listPaginated({
				search: search === '' ? undefined : search,
				sort,
				order,
				start: 0,
				limit: pageSize
			});
			const usersTask = fetchAssignedUsers(current, canListUsers);
			const response = await pageTask;
			const users = await usersTask;
			if (!applyPage(response, true, 0, generation)) return;
			const usersByID = new Map(users.map((user) => [user.id, user]));
			const currentUser = useClientManager.getState().currentUser;
			if (currentUser) usersByID.set(currentUser.id, currentUser);
			setAssignedUsers(usersByID);
		} catch (error) {
			if (!ProgressivePaginationState.accepts(paginationRef.current, generation)) return;
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (ProgressivePaginationState.accepts(paginationRef.current, generation))
				setIsLoading(false);
		}
	};

	const loadMore = async () => {
		const current = useClientManager.getState().client;
		if (!paginationRef.current.hasMore || isLoadingMoreRef.current || !current) return;
		setLoadingMore(true);
		setLoadMoreError(undefined);
		const { generation, nextStart: start } = paginationRef.current;
		const { search, sort, order } = query.current;
		try {
			const response = await current.apiKeys.listPaginated({
				search: search === '' ? undefined : search,
				sort,
				order,
				start,
				limit: pageSize
			});
			applyPage(response, false, start, generation);
		} catch (error) {
			if (!ProgressivePaginationState.accepts(paginationRef.current, generation)) return;
			setLoadMoreError(friendlyErrorMessage(error));
		} finally {
			if (ProgressivePaginationState.accepts(paginationRef.current, generation))
				setLoadingMore(false);
		}
	};

	const latestLoad = useRef(loadKeys);
	latestLoad.current = loadKeys;
	const reload = useCallback(() => latestLoad.current(), []);

	// `.task { await loadKeys() }` + `.onChange(of: debouncedSearchText / sortField / sortOrder)`.
	useEffect(() => {
		void reload();
	}, [reload, client]);
	useOnChange(debouncedSearchText, () => void reload());
	useOnChange(sortField, () => void reload());
	useOnChange(sortOrder, () => void reload());

	const presentSecret = useSecretPresentation();

	const showCreateSheet = () => {
		const payload: CreateAPIKeyPayload = {
			onCreated: (key) => {
				presentSecret(APIKeySecretPresentation.created(key));
				invalidateAPIKeyCache();
				void reload();
			}
		};
		navigation.push('settings/api-keys/create', { token: settingsPayloads.put(payload) });
	};

	const assignedUser = (key: APIKey) => (key.userId ? assignedUsers.get(key.userId) : undefined);

	const openDetail = (key: APIKey) => {
		const payload: APIKeyDetailPayload = {
			apiKey: key,
			assignedUser: assignedUser(key),
			onChanged: reload
		};
		navigation.push('settings/api-keys/detail', { token: settingsPayloads.put(payload) });
	};

	const copyPrefix = (key: APIKey) => {
		void Clipboard.setStringAsync(key.keyPrefix);
		showToast(Toasts.copied('Key prefix copied'));
	};

	return {
		access,
		apiKeys,
		isLoading,
		isLoadingMore,
		errorMessage,
		searchText,
		setSearchText,
		debouncedSearchText,
		sortField,
		setSortField,
		sortOrder,
		setSortOrder,
		pagination,
		loadMoreError,
		loadKeys: reload,
		loadMore,
		showCreateSheet,
		openDetail,
		assignedUser,
		copyPrefix
	};
}

export type APIKeysModel = ReturnType<typeof useAPIKeys>;
