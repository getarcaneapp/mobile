import { create } from 'zustand';

import type { ResourceUpdateFilter } from '@/features/containers/container-model';
import type { ListEnvironment } from '@/stores/environments-store';

import type { ListSortOrder, ProjectStatusFilter, ProjectTagOption } from './project-model';

export type ProjectsFilterState = {
	environmentFilter?: string;
	statusFilter: ProjectStatusFilter;
	updateFilter: ResourceUpdateFilter;
	tagFilter: string[];
	tagOptions: ProjectTagOption[];
	sortOrder: ListSortOrder;
	environments: ListEnvironment[];
	listEnvironments: ListEnvironment[];
};

export const defaultProjectsFilter: ProjectsFilterState = {
	statusFilter: 'All',
	updateFilter: 'all',
	tagFilter: [],
	tagOptions: [],
	sortOrder: 'ascending',
	environments: [],
	listEnvironments: []
};

type Store = {
	lists: Record<string, ProjectsFilterState>;
	update: (key: string, patch: Partial<ProjectsFilterState>) => void;
	remove: (key: string) => void;
};

export const useProjectsFilterStore = create<Store>((set) => ({
	lists: {},
	update: (key, patch) =>
		set((s) => ({
			lists: { ...s.lists, [key]: { ...(s.lists[key] ?? defaultProjectsFilter), ...patch } }
		})),
	remove: (key) =>
		set((s) => {
			const { [key]: _removed, ...rest } = s.lists;
			return { lists: rest };
		})
}));

export function useProjectsFilter(key: string): ProjectsFilterState {
	return useProjectsFilterStore((s) => s.lists[key] ?? defaultProjectsFilter);
}

export function projectsActiveFilterCount(filter: ProjectsFilterState): number {
	let count = filter.statusFilter !== 'All' ? 1 : 0;
	if (filter.environmentFilter !== undefined) count += 1;
	if (filter.updateFilter !== 'all') count += 1;
	if (filter.tagFilter.length > 0) count += 1;
	return count;
}
