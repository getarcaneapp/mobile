import { createContext, type ReactNode } from 'react';

export const ListUX = {
	searchDebounce: 200,
	pageSizeDefault: 50
} as const;

export const LoadsOnEndReachedContext = createContext(false);

export type PaginatedListFooterProps = {
	hasMore: boolean;
	loadMoreError?: string;
	onRetry: () => void;
	onLoadMore: () => void;
};

export type ResourceListContainerProps = {
	isLoading: boolean;
	isEmpty: boolean;
	errorMessage?: string;
	children: ReactNode;
};

export function isValidURL(urlString: string): boolean {
	try {
		return Boolean(new URL(urlString).protocol);
	} catch {
		return false;
	}
}
