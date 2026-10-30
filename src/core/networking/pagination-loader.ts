import type { PaginationResponse } from '@/sdk/models/base/pagination';
import type { EnvironmentFailure } from '@/sdk/pagination/PaginatedResponse';

import { RemoteDataLimitError, RemoteDataLimits } from './remote-data-limits';

export type Identifiable = { id: string };

export interface ResourcePage<Element> {
	items: Element[];
	pagination: PaginationResponse;
	failedEnvironments?: EnvironmentFailure[];
}

export function resourcePage<Element>(response: {
	data: Element[];
	pagination: PaginationResponse;
	failedEnvironments?: EnvironmentFailure[];
}): ResourcePage<Element> {
	return {
		items: response.data,
		pagination: response.pagination,
		failedEnvironments: response.failedEnvironments
	};
}

export type FetchPage<Element> = (start: number, limit: number) => Promise<ResourcePage<Element>>;

const maxSafeOffset = Number.MAX_SAFE_INTEGER;

export const PaginationLoader = {
	defaultPageSize: 50,

	async collect<Element extends Identifiable>(
		fetchPage: FetchPage<Element>,
		options: { pageSize?: number; maximumItems?: number } = {}
	): Promise<Element[]> {
		const limit = Math.max(1, options.pageSize ?? PaginationLoader.defaultPageSize);
		const itemLimit = Math.max(1, options.maximumItems ?? RemoteDataLimits.maximumCollectionItems);
		let start = 0;
		const collected: Element[] = [];
		const seen = new Set<string>();

		const append = (page: ResourcePage<Element>) => {
			if (page.pagination.totalItems > itemLimit)
				throw RemoteDataLimitError.collectionTooLarge(itemLimit);
			for (const item of page.items) {
				if (seen.has(item.id)) continue;
				seen.add(item.id);
				if (collected.length >= itemLimit) throw RemoteDataLimitError.collectionTooLarge(itemLimit);
				collected.push(item);
			}
		};

		const next = (
			page: ResourcePage<Element>,
			at: number
		): { start: number; stride: number } | undefined => {
			const pageStride = page.pagination.itemsPerPage > 0 ? page.pagination.itemsPerPage : limit;
			const nextStart = at + pageStride;
			if (nextStart > maxSafeOffset || nextStart <= at)
				throw RemoteDataLimitError.collectionTooLarge(itemLimit);
			let reachedEnd: boolean;
			if (page.pagination.hasNextPage !== undefined && page.pagination.totalItems < 0) {
				reachedEnd = !page.pagination.hasNextPage;
			} else if (page.pagination.totalItems >= 0) {
				reachedEnd = nextStart >= page.pagination.totalItems;
			} else if (page.pagination.totalPages >= 0) {
				reachedEnd = page.pagination.currentPage >= page.pagination.totalPages;
			} else {
				reachedEnd = page.items.length < pageStride;
			}
			if (page.items.length === 0 || reachedEnd) return undefined;
			return { start: nextStart, stride: pageStride };
		};

		let usedKnownTotal = false;
		while (true) {
			const page = await fetchPage(start, limit);
			append(page);
			const following = next(page, start);
			if (!following) return collected;

			if (usedKnownTotal || page.pagination.totalItems < 0) {
				start = following.start;
				continue;
			}
			usedKnownTotal = true;
			const total = Math.min(page.pagination.totalItems, itemLimit);
			const starts: number[] = [];
			for (let offset = following.start; offset < total; offset += following.stride)
				starts.push(offset);
			if (starts.length <= 1) {
				start = following.start;
				continue;
			}
			const pages = await Promise.all(starts.map((pageStart) => fetchPage(pageStart, limit)));
			for (const loaded of pages) append(loaded);
			const lastStart = starts[starts.length - 1];
			const lastPage = pages[pages.length - 1];
			if (lastStart === undefined || !lastPage) return collected;
			const after = next(lastPage, lastStart);
			if (!after) return collected;
			start = after.start;
		}
	},

	cachePath(path: string): string {
		return path + '#all-pages';
	},

	merge<Element extends Identifiable>(
		current: Element[],
		incoming: Element[],
		reset: boolean
	): Element[] {
		const merged: Element[] = [];
		const seen = new Set<string>();
		for (const item of reset ? incoming : [...current, ...incoming]) {
			if (seen.has(item.id)) continue;
			seen.add(item.id);
			merged.push(item);
		}
		return merged;
	}
} as const;

export interface ProgressivePaginationState {
	readonly generation: number;
	readonly nextStart: number;
	readonly hasMore: boolean;
	readonly totalItems: number | undefined;
}

export const ProgressivePaginationState = {
	initial: {
		generation: 0,
		nextStart: 0,
		hasMore: false,
		totalItems: undefined
	} as ProgressivePaginationState,

	reset(state: ProgressivePaginationState): ProgressivePaginationState {
		return {
			generation: state.generation + 1,
			nextStart: 0,
			hasMore: false,
			totalItems: undefined
		};
	},

	accepts(state: ProgressivePaginationState, requestGeneration: number): boolean {
		return state.generation === requestGeneration;
	},

	receive(
		state: ProgressivePaginationState,
		args: {
			pagination: PaginationResponse;
			itemCount: number;
			requestedStart: number;
			requestedLimit: number;
			generation: number;
		}
	): ProgressivePaginationState | undefined {
		if (state.generation !== args.generation) return undefined;
		const { pagination, itemCount, requestedStart, requestedLimit } = args;
		const totalItems = pagination.totalItems >= 0 ? pagination.totalItems : state.totalItems;
		const pageStride =
			pagination.itemsPerPage > 0 ? pagination.itemsPerPage : Math.max(1, requestedLimit);
		const candidateStart = requestedStart + pageStride;
		if (candidateStart > maxSafeOffset || candidateStart <= requestedStart) {
			return { ...state, totalItems, hasMore: false };
		}
		if (itemCount <= 0) return { ...state, totalItems, nextStart: candidateStart, hasMore: false };
		let hasMore: boolean;
		if (pagination.hasNextPage !== undefined && pagination.totalItems < 0) {
			hasMore = pagination.hasNextPage;
		} else if (pagination.totalItems >= 0) {
			hasMore = candidateStart < pagination.totalItems;
		} else if (pagination.totalPages >= 0) {
			hasMore = pagination.currentPage < pagination.totalPages;
		} else {
			hasMore = itemCount >= pageStride;
		}
		return { ...state, totalItems, nextStart: candidateStart, hasMore };
	}
} as const;

export async function progressiveFanOut<Input, Output>(
	inputs: readonly Input[],
	work: (input: Input) => Promise<Output>,
	deliver: (batch: Output[]) => void,
	intervalMs = 100
): Promise<void> {
	if (inputs.length === 0) return;
	let remaining = inputs.length;
	let pending: Output[] = [];
	let lastDelivery: number | undefined;
	let tick: ReturnType<typeof setTimeout> | undefined;

	await new Promise<void>((resolve) => {
		const flush = () => {
			tick = undefined;
			if (pending.length === 0) return;
			const batch = pending;
			pending = [];
			lastDelivery = Date.now();
			deliver(batch);
		};
		const onOutput = (output: Output) => {
			remaining -= 1;
			pending.push(output);
			if (remaining === 0) {
				if (tick !== undefined) clearTimeout(tick);
				flush();
				resolve();
				return;
			}
			const now = Date.now();
			if (lastDelivery !== undefined && now - lastDelivery < intervalMs) {
				if (tick === undefined) tick = setTimeout(flush, intervalMs - (now - lastDelivery));
			} else {
				if (tick !== undefined) clearTimeout(tick);
				flush();
			}
		};
		for (const input of inputs) {
			void work(input).then(onOutput);
		}
	});
}
