import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { cachedClient } from '@/core/networking/use-cached-client';
import { PaginationLoader, ProgressivePaginationState } from '@/core/networking/pagination-loader';
import { User } from '@/sdk/models/user/User';
import type { ContainerRegistry } from '@/sdk/models/containerRegistry/ContainerRegistry';
import type { PaginatedResponse } from '@/sdk/pagination/PaginatedResponse';
import { useClientManager } from '@/stores/client-manager';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { ListUX } from '@/ui/components/paginated-list';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';

import type { RegistryFormPayload } from './use-registry-form';

const pageSize = 50;

export const registryCachePaths = ['container-registries', 'container-registries/*'];

export function registryName(registry: ContainerRegistry): string {
	if (registry.description) return registry.description;
	try {
		const host = new URL(registry.url).hostname;
		return host !== '' ? host : registry.url;
	} catch {
		return registry.url;
	}
}

export function registryRowTitle(registry: ContainerRegistry): string {
	const name = registryName(registry).trim();
	if (name !== '' && name !== registry.url) return name;
	if (registry.url !== '') return registry.url;
	return name === '' ? registry.id : name;
}

export function registryRowSubtitle(registry: ContainerRegistry): string {
	const title = registryRowTitle(registry);
	if (title !== registry.url && registry.url !== '') return registry.url;
	return registry.registryType === 'ecr' ? 'AWS ECR' : 'Generic';
}

export function useContainerRegistries() {
	const client = useClientManager((s) => s.client);
	const isAdmin = useClientManager((s) => (s.currentUser ? User.isAdmin(s.currentUser) : false));
	const navigation = useSettingsNavigation();

	const [registries, setRegistries] = useState<ContainerRegistry[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [actionErrorMessage, setActionErrorMessage] = useState<string>();
	const [pendingDeleteRegistry, setPendingDeleteRegistry] = useState<ContainerRegistry>();
	const [searchText, setSearchText] = useState('');
	const [debouncedSearchText, setDebouncedSearchText] = useState('');
	const [hasMore, setHasMore] = useState(false);
	const [totalItems, setTotalItems] = useState<number>();
	const [loadMoreError, setLoadMoreError] = useState<string>();

	const pagination = useRef(ProgressivePaginationState.initial);
	const isLoadingMore = useRef(false);
	const registriesRef = useRef(registries);
	registriesRef.current = registries;
	const searchRef = useRef(debouncedSearchText);
	searchRef.current = debouncedSearchText;

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearchText(searchText), ListUX.searchDebounce);
		return () => clearTimeout(timer);
	}, [searchText]);

	const applyPage = useCallback(
		(
			response: PaginatedResponse<ContainerRegistry>,
			reset: boolean,
			requestedStart: number,
			generation: number
		) => {
			const received = ProgressivePaginationState.receive(pagination.current, {
				pagination: response.pagination,
				itemCount: response.data.length,
				requestedStart,
				requestedLimit: pageSize,
				generation
			});
			if (!received) return;
			pagination.current = received;
			setHasMore(received.hasMore);
			setTotalItems(received.totalItems);
			setRegistries(PaginationLoader.merge(registriesRef.current, response.data, reset));
			setLoadMoreError(undefined);
			setErrorMessage(undefined);
		},
		[]
	);

	const loadRegistries = useCallback(async () => {
		if (!isAdmin || !client) return;
		pagination.current = ProgressivePaginationState.reset(pagination.current);
		const generation = pagination.current.generation;
		setHasMore(false);
		isLoadingMore.current = false;
		if (registriesRef.current.length === 0) setIsLoading(true);
		setErrorMessage(undefined);
		setLoadMoreError(undefined);
		try {
			const search = searchRef.current;
			const response = await client.registries.listPaginated({
				search: search === '' ? undefined : search,
				start: 0,
				limit: pageSize
			});
			applyPage(response, true, 0, generation);
		} catch (error) {
			if (!ProgressivePaginationState.accepts(pagination.current, generation)) return;
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (ProgressivePaginationState.accepts(pagination.current, generation)) setIsLoading(false);
		}
	}, [isAdmin, client, applyPage]);

	const loadMore = useCallback(async () => {
		if (!pagination.current.hasMore || isLoadingMore.current || !client) return;
		isLoadingMore.current = true;
		setLoadMoreError(undefined);
		const generation = pagination.current.generation;
		const start = pagination.current.nextStart;
		try {
			const search = searchRef.current;
			const response = await client.registries.listPaginated({
				search: search === '' ? undefined : search,
				start,
				limit: pageSize
			});
			applyPage(response, false, start, generation);
		} catch (error) {
			if (!ProgressivePaginationState.accepts(pagination.current, generation)) return;
			setLoadMoreError(friendlyErrorMessage(error));
		} finally {
			if (ProgressivePaginationState.accepts(pagination.current, generation))
				isLoadingMore.current = false;
		}
	}, [client, applyPage]);

	useEffect(() => {
		void loadRegistries();
	}, [loadRegistries, debouncedSearchText]);

	const afterSave = useCallback(async () => {
		cachedClient()?.invalidateGlobal(registryCachePaths);
		await loadRegistries();
	}, [loadRegistries]);

	const openForm = useCallback(
		(registry: ContainerRegistry | undefined) => {
			const payload: RegistryFormPayload = { registry, onSuccess: afterSave };
			navigation.push('settings/registries/form', { token: settingsPayloads.put(payload) });
		},
		[navigation, afterSave]
	);

	const deleteRegistry = useCallback(
		async (registry: ContainerRegistry) => {
			if (!isAdmin || !client) return;
			try {
				await client.registries.delete({ id: registry.id });
				setRegistries((current) => current.filter((item) => item.id !== registry.id));
				cachedClient()?.invalidateGlobal(registryCachePaths);
				await loadRegistries();
				showToast(Toasts.success('Registry deleted'));
			} catch (error) {
				setActionErrorMessage(friendlyErrorMessage(error));
			}
		},
		[isAdmin, client, loadRegistries]
	);

	useItemDeleteConfirmation(pendingDeleteRegistry, setPendingDeleteRegistry, (registry) => ({
		title: 'Delete Registry',
		message: 'This removes the container registry and its saved credentials.',
		icon: 'trash',
		actions: [{ title: 'Delete', action: () => void deleteRegistry(registry) }]
	}));

	const refresh = useCallback(async () => {
		if (!isAdmin) return;
		await loadRegistries();
	}, [isAdmin, loadRegistries]);

	return {
		isAdmin,
		registries,
		isLoading,
		errorMessage,
		actionErrorMessage,
		dismissActionError: () => setActionErrorMessage(undefined),
		pendingDeleteRegistry,
		setPendingDeleteRegistry,
		setSearchText,
		hasMore,
		totalItems,
		loadMoreError,
		loadRegistries,
		loadMore,
		refresh,
		openCreate: () => openForm(undefined),
		openEdit: (registry: ContainerRegistry) => openForm(registry),
		deleteRegistry
	};
}

export type ContainerRegistriesModel = ReturnType<typeof useContainerRegistries>;
