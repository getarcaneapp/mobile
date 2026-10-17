import type { QueryItem } from '../../client/url';

export interface PaginationResponse {
	totalPages: number;
	totalItems: number;
	currentPage: number;
	itemsPerPage: number;
	grandTotalItems?: number;
}

export type SortOrder = 'asc' | 'desc';

export const SortOrder = {
	ascending: 'asc',
	descending: 'desc'
} as const satisfies Record<string, SortOrder>;

export interface SearchPaginationSort {
	search?: string;
	start?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: SortOrder;
}

export const SearchPaginationSort = {
	queryItems(query: SearchPaginationSort = {}): QueryItem[] {
		const items: QueryItem[] = [];
		if (query.search !== undefined) items.push({ name: 'search', value: query.search });
		if (query.start !== undefined) items.push({ name: 'start', value: String(query.start) });
		if (query.limit !== undefined) items.push({ name: 'limit', value: String(query.limit) });
		if (query.sortBy !== undefined) items.push({ name: 'sort', value: query.sortBy });
		if (query.sortOrder !== undefined) items.push({ name: 'order', value: query.sortOrder });
		return items;
	},

	nonPaginationQueryItems(query: SearchPaginationSort = {}): QueryItem[] {
		const items: QueryItem[] = [];
		if (query.search !== undefined) items.push({ name: 'search', value: query.search });
		if (query.sortBy !== undefined) items.push({ name: 'sort', value: query.sortBy });
		if (query.sortOrder !== undefined) items.push({ name: 'order', value: query.sortOrder });
		return items;
	}
} as const;
