import type { PaginationResponse } from '../models/base/pagination';

export interface EnvironmentFailure {
	environment: { id: string; name?: string };
	message?: string;
}

export interface EnvironmentRef {
	id: string;
	name?: string;
}

const itemEnvironments = new WeakMap<object, EnvironmentRef>();

function readEnvironmentTag(raw: unknown): EnvironmentRef | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const o = raw as { environmentId?: unknown; environmentName?: unknown };
	if (typeof o.environmentId !== 'string' || o.environmentId === '') return undefined;
	return {
		id: o.environmentId,
		name:
			typeof o.environmentName === 'string' && o.environmentName !== ''
				? o.environmentName
				: undefined
	};
}

export const ItemEnvironment = {
	tagging<T>(this: void, decode: (raw: unknown) => T): (raw: unknown) => T {
		return (raw) => {
			const value = decode(raw);
			const tag = readEnvironmentTag(raw);
			if (tag && typeof value === 'object' && value !== null) itemEnvironments.set(value, tag);
			return value;
		};
	},

	get(this: void, item: unknown): EnvironmentRef | undefined {
		if (typeof item !== 'object' || item === null) return undefined;
		return itemEnvironments.get(item) ?? readEnvironmentTag(item);
	},

	carry<T>(this: void, from: unknown, to: T): T {
		const tag = ItemEnvironment.get(from);
		if (tag && typeof to === 'object' && to !== null) itemEnvironments.set(to, tag);
		return to;
	}
} as const;

export interface PaginatedResponse<T> {
	success: boolean;
	data: T[];
	pagination: PaginationResponse;
	failedEnvironments?: EnvironmentFailure[];
}

export type PageFetcher<Element> = (
	start: number,
	limit: number
) => Promise<PaginatedResponse<Element>>;

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
			if (response.pagination.hasNextPage !== undefined && response.pagination.totalItems < 0) {
				finished = buffer.length === 0 || !response.pagination.hasNextPage;
			} else if (response.pagination.totalItems >= 0) {
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
