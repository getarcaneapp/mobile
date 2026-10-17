import { create } from 'zustand';

import type { ListSortOrder } from '@/core/list-sort-order';
import type { ListEnvironment } from '@/stores/environments-store';

import type { ImageTagsFilter } from './image-model';

export type ImagesFilterState = {
	environmentFilter?: string;
	tagsFilter: ImageTagsFilter;
	sortOrder: ListSortOrder;
	environments: ListEnvironment[];
};

export const defaultImagesFilter: ImagesFilterState = {
	tagsFilter: 'All',
	sortOrder: 'ascending',
	environments: []
};

type Store = {
	lists: Record<string, ImagesFilterState>;
	update: (key: string, patch: Partial<ImagesFilterState>) => void;
	remove: (key: string) => void;
};

export const useImagesFilterStore = create<Store>((set) => ({
	lists: {},
	update: (key, patch) =>
		set((s) => ({
			lists: { ...s.lists, [key]: { ...(s.lists[key] ?? defaultImagesFilter), ...patch } }
		})),
	remove: (key) =>
		set((s) => {
			const { [key]: _removed, ...rest } = s.lists;
			return { lists: rest };
		})
}));

export function useImagesFilter(key: string): ImagesFilterState {
	return useImagesFilterStore((s) => s.lists[key] ?? defaultImagesFilter);
}
