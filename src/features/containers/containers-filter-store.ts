import { create } from 'zustand';

import type { ListEnvironment } from '@/stores/environments-store';

import type {
	ContainerListSort,
	ContainerStateFilter,
	ResourceUpdateFilter
} from './container-model';

export type ContainersFilterState = {
	environmentFilter?: string;
	stateFilter: ContainerStateFilter;
	updateFilter: ResourceUpdateFilter;
	showHidden: boolean;
	labelFilter: string;
	sort: ContainerListSort;
	environments: ListEnvironment[];
};

export const defaultContainersFilter: ContainersFilterState = {
	stateFilter: 'All',
	updateFilter: 'all',
	showHidden: false,
	labelFilter: '',
	sort: 'nameAscending',
	environments: []
};

type Store = {
	lists: Record<string, ContainersFilterState>;
	update: (key: string, patch: Partial<ContainersFilterState>) => void;
	remove: (key: string) => void;
};

export const useContainersFilterStore = create<Store>((set) => ({
	lists: {},
	update: (key, patch) =>
		set((s) => ({
			lists: { ...s.lists, [key]: { ...(s.lists[key] ?? defaultContainersFilter), ...patch } }
		})),
	remove: (key) =>
		set((s) => {
			const { [key]: _removed, ...rest } = s.lists;
			return { lists: rest };
		})
}));

export function useContainersFilter(key: string): ContainersFilterState {
	return useContainersFilterStore((s) => s.lists[key] ?? defaultContainersFilter);
}
