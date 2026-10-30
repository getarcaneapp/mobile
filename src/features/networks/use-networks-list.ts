import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { performAllEnvironmentsPrune } from '@/core/all-environments-actions';
import { friendlyErrorMessage } from '@/core/errors';
import { ResourcePruneAction } from '@/core/resource-prune-action';
import { nextInstanceKey } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { NetworkSummary } from '@/sdk/models/network/Network';
import { useAllEnvironmentsOperationStore } from '@/stores/all-environments-operation-store';
import { resourcePage } from '@/core/networking/pagination-loader';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentPagedList, type EnvironmentFetch } from '@/stores/environment-paged-list';
import { useEnvironmentsStore, type ListEnvironment } from '@/stores/environments-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import {
	useItemDeleteConfirmation,
	type DeleteConfirmationConfig
} from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { useDebounced, useOnChange } from '@/features/containers/hooks';

import { deleteNetworkRequest, networksChanged } from './network-actions';
import { partitionNetworks, type NetworkItem } from './network-model';
import {
	activeNetworkFilterCount,
	useNetworksFilter,
	useNetworksFilterStore
} from './networks-filter-store';
import { screenCache, useTabRouter } from './tab-routes';

const pageSize = 50;

type NetworkDestructive = { kind: 'prune' } | { kind: 'delete'; network: NetworkItem };

export type NetworksListProps = {
	environmentID: EnvironmentID;
	environmentName: string;
	allEnvironments?: boolean;
};

export const networkCacheKey = (environmentID: EnvironmentID, id: string) =>
	`network:${environmentID}/${id}`;

export function showActionFailed(message: string, title = 'Action Failed') {
	Alert.alert(title, message, [{ text: 'OK', style: 'cancel' }]);
}

export function useNetworksList({ environmentID, allEnvironments = false }: NetworksListProps) {
	const nav = useTabRouter();
	const client = useClientManager((s) => s.client);
	const [listKey] = useState(() => nextInstanceKey('networks'));
	const filter = useNetworksFilter(listKey);
	const updateFilter = useNetworksFilterStore((s) => s.update);
	useEffect(() => () => useNetworksFilterStore.getState().remove(listKey), [listKey]);

	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);
	const [list, snapshot] = useEnvironmentPagedList<NetworkSummary>(pageSize);
	const networks = snapshot.items;
	const [pendingDestructive, setPendingDestructive] = useState<NetworkDestructive>();
	const isOperationRunning = useAllEnvironmentsOperationStore((s) => s.isRunning);

	useEffect(() => {
		updateFilter(listKey, { environments: snapshot.environments });
	}, [listKey, snapshot.environments, updateFilter]);

	const listEnvironments: ListEnvironment[] = allEnvironments
		? snapshot.environments
		: [{ id: environmentID }];

	const networksPage = useCallback((): EnvironmentFetch<NetworkSummary> | undefined => {
		const current = useClientManager.getState().client;
		if (!current) return undefined;
		return async (envID, start, limit) => {
			const response = await current.networks.list({ envID, query: { start, limit } });
			return resourcePage(response);
		};
	}, []);

	const loadNetworks = useCallback(
		async (preservingLoadedRange = false) => {
			const fetch = networksPage();
			if (!fetch) return;
			const environments = await useEnvironmentsStore
				.getState()
				.listEnvironments(environmentID, allEnvironments);
			await list.reload(environments, fetch, { preservingLoadedRange, aggregates: true });
		},
		[networksPage, list, environmentID, allEnvironments]
	);

	const loadMore = useCallback(async () => {
		const fetch = networksPage();
		if (fetch) await list.loadMore(fetch);
	}, [networksPage, list]);

	useFocusEffect(
		useCallback(() => {
			void loadNetworks(true);
		}, [loadNetworks])
	);

	const mutationVersion = useResourceMutationStore((s) =>
		(allEnvironments ? snapshot.environments.map((e) => e.id) : [environmentID]).reduce(
			(total, id) => total + (s.versions[`networks::${id}`] ?? 0),
			0
		)
	);
	useOnChange(mutationVersion, () => void loadNetworks(true));
	useOnChange(client, () => void loadNetworks());

	const { system, user } = useMemo(
		() =>
			partitionNetworks(networks, {
				search: debouncedSearch,
				environmentFilter: filter.environmentFilter,
				typeFilter: filter.typeFilter,
				sortOrder: filter.sortOrder
			}),
		[networks, debouncedSearch, filter.environmentFilter, filter.typeFilter, filter.sortOrder]
	);

	const deleteNetwork = async (network: NetworkItem) => {
		try {
			if (!(await deleteNetworkRequest(network.environmentID, network.value.id))) return;
			list.updateItems((items) => items.filter((item) => item.id !== network.id));
			networksChanged(network.environmentID);
			showToast(Toasts.success('Network deleted'));
		} catch (error) {
			showActionFailed(friendlyErrorMessage(error));
		}
	};

	const pruneNetworks = async () => {
		if (allEnvironments) {
			await performAllEnvironmentsPrune(
				'networks',
				useEnvironmentsStore.getState().enabledEnvironments()
			);
			return;
		}
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			await ResourcePruneAction.perform('networks', current, environmentID);
			networksChanged(environmentID);
			showToast(Toasts.success('Networks pruned'));
		} catch (error) {
			showActionFailed(friendlyErrorMessage(error));
		}
	};

	useItemDeleteConfirmation(
		pendingDestructive,
		setPendingDestructive,
		(pending): DeleteConfirmationConfig => {
			switch (pending.kind) {
				case 'prune':
					return {
						title: 'Prune Networks',
						message: allEnvironments
							? ResourcePruneAction.allEnvironmentsMessage('networks')
							: 'Remove all unused networks.',
						icon: 'trash',
						actions: [{ title: 'Prune', action: () => void pruneNetworks() }],
						dismissOnConfirm: false
					};
				case 'delete':
					return {
						title: 'Delete Network',
						message: `Delete “${pending.network.value.name}”? This cannot be undone.`,
						icon: 'trash',
						actions: [{ title: 'Delete', action: () => void deleteNetwork(pending.network) }],
						dismissOnConfirm: false
					};
			}
		}
	);

	return {
		listKey,
		allEnvironments,
		environmentID,
		snapshot,
		networks,
		systemNetworks: system,
		userNetworks: user,
		listEnvironments,
		searchText,
		setSearchText,
		activeFilterCount: activeNetworkFilterCount(filter),
		loadNetworks,
		loadMore,
		refresh: () => loadNetworks(),
		isOperationRunning,
		openFilter: () => nav.push('networks-filter', { key: listKey }),
		openDetail: (network: NetworkItem) => {
			screenCache.set(networkCacheKey(network.environmentID, network.value.id), network.value);
			nav.push(`network/${encodeURIComponent(network.value.id)}`, { envID: network.environmentID });
		},
		presentCreateSheet: (envID: EnvironmentID) => nav.push('network-create', { envID }),
		requestDelete: (network: NetworkItem) => setPendingDestructive({ kind: 'delete', network }),
		requestPrune: () => setPendingDestructive({ kind: 'prune' })
	};
}

export type NetworksListModel = ReturnType<typeof useNetworksList>;
