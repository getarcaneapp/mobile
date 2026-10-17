/** Port of Pagination/PaginatedResponse.swift. */
import type { PaginationResponse } from '../models/base/pagination';

export interface PaginatedResponse<T> {
	success: boolean;
	data: T[];
	pagination: PaginationResponse;
}

export type PageFetcher<Element> = (
	start: number,
	limit: number
) => Promise<PaginatedResponse<Element>>;

/**
 * An async iterable that walks a paginated endpoint, fetching successive
 * `limit`-sized pages until `pagination.totalItems` is exhausted.
 *
 * ```ts
 * for await (const c of new ArcanePaginator(50, (start, limit) =>
 *   client.rest.paginated("environments/0/containers", { start, limit }))) { … }
 * ```
 */
export class ArcanePaginator<Element> implements AsyncIterable<Element> {
	private readonly limit: number;
	private readonly fetch: PageFetcher<Element>;

	constructor(limit: number, fetch: PageFetcher<Element>);
	constructor(fetch: PageFetcher<Element>);
	constructor(limitOrFetch: number | PageFetcher<Element>, fetch?: PageFetcher<Element>) {
		if (typeof limitOrFetch === 'function') {
			this.limit = 50;
			this.fetch = limitOrFetch;
		} else {
			this.limit = Math.max(1, limitOrFetch);
			if (!fetch) throw new Error('ArcanePaginator requires a fetch function');
			this.fetch = fetch;
		}
	}

	async *[Symbol.asyncIterator](): AsyncIterator<Element> {
		let start = 0;
		let finished = false;
		while (!finished) {
			const response = await this.fetch(start, this.limit);
			const buffer = response.data;
			const pageStride =
				response.pagination.itemsPerPage > 0 ? response.pagination.itemsPerPage : this.limit;
			start += pageStride;
			if (response.pagination.totalItems >= 0) {
				finished = buffer.length === 0 || start >= response.pagination.totalItems;
			} else if (response.pagination.totalPages >= 0) {
				finished =
					buffer.length === 0 || response.pagination.currentPage >= response.pagination.totalPages;
			} else {
				finished = buffer.length === 0 || buffer.length < pageStride;
			}
			for (const element of buffer) yield element;
		}
	}
}
