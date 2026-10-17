import type { ReactNode } from 'react';

/** Port of `ListUX`. */
export const ListUX = {
	/** Debounce interval (ms) for search fields across resource lists. */
	searchDebounce: 200,
	/** Auto-pagination loads the next page when the progress footer appears. */
	pageSizeDefault: 50
} as const;

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

/** `URL(string:)` succeeding, roughly: an absolute URL with a scheme. */
export function isValidURL(urlString: string): boolean {
	try {
		return Boolean(new URL(urlString).protocol);
	} catch {
		return false;
	}
}
