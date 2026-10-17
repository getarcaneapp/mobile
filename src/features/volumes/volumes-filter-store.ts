import { create } from 'zustand';

import type { ListSortOrder } from '@/core/list-sort-order';
import type { ListEnvironment } from '@/stores/environments-store';

import type { VolumeScopeFilter } from './volume-model';

export type VolumesFilterState = {
	environmentFilter?: string;
	scopeFilter: VolumeScopeFilter;
	sortOrder: ListSortOrder;
	environments: ListEnvironment[];
};

export const defaultVolumesFilter: VolumesFilterState = {
	scopeFilter: 'All',
	sortOrder: 'ascending',
	environments: []
};

type Store = {
	lists: Record<string, VolumesFilterState>;
	update: (key: string, patch: Partial<VolumesFilterState>) => void;
	remove: (key: string) => void;
};

export const useVolumesFilterStore = create<Store>((set) => ({
	lists: {},
	update: (key, patch) =>
		set((s) => ({
			lists: { ...s.lists, [key]: { ...(s.lists[key] ?? defaultVolumesFilter), ...patch } }
		})),
	remove: (key) =>
		set((s) => {
			const { [key]: _removed, ...rest } = s.lists;
			return { lists: rest };
		})
}));

export function useVolumesFilter(key: string): VolumesFilterState {
	return useVolumesFilterStore((s) => s.lists[key] ?? defaultVolumesFilter);
}

export function volumesActiveFilterCount(filter: VolumesFilterState) {
	return (filter.scopeFilter !== 'All' ? 1 : 0) + (filter.environmentFilter !== undefined ? 1 : 0);
}
