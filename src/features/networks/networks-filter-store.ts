/**
 * NetworksView's filter/sort `@State`, keyed per list instance so the Filter
 * sheet (a separate route here) edits the list that opened it.
 */
import { create } from 'zustand';

import type { ListSortOrder } from '@/core/list-sort-order';
import type { ListEnvironment } from '@/stores/environments-store';

import type { NetworkTypeFilter } from './network-model';

export type NetworksFilterState = {
	environmentFilter?: string;
	typeFilter: NetworkTypeFilter;
	sortOrder: ListSortOrder;
	/** The list's environments, for the Environment filter section. */
	environments: ListEnvironment[];
};

export const defaultNetworksFilter: NetworksFilterState = {
	typeFilter: 'All',
	sortOrder: 'ascending',
	environments: []
};

type Store = {
	lists: Record<string, NetworksFilterState>;
	update: (key: string, patch: Partial<NetworksFilterState>) => void;
	remove: (key: string) => void;
};

export const useNetworksFilterStore = create<Store>((set) => ({
	lists: {},
	update: (key, patch) =>
		set((s) => ({
			lists: { ...s.lists, [key]: { ...(s.lists[key] ?? defaultNetworksFilter), ...patch } }
		})),
	remove: (key) =>
		set((s) => {
			const { [key]: _removed, ...rest } = s.lists;
			return { lists: rest };
		})
}));

export function useNetworksFilter(key: string): NetworksFilterState {
	return useNetworksFilterStore((s) => s.lists[key] ?? defaultNetworksFilter);
}

export function activeNetworkFilterCount(filter: NetworksFilterState) {
	return (filter.typeFilter !== 'All' ? 1 : 0) + (filter.environmentFilter !== undefined ? 1 : 0);
}
