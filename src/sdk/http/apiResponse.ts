/** Port of HTTP/APIResponse.swift and Pagination/PaginatedResponse.swift envelopes. */
import type { PaginationResponse } from '../models/base/pagination';

export interface APIResponse<T> {
	success: boolean;
	data: T;
}

export interface PaginatedAPIResponse<T> {
	success: boolean;
	data: T[];
	pagination: PaginationResponse;
}

/** Swift `EmptyBody` / `Optional<EmptyBody>.none`: send no body. */
export type EmptyBody = Record<string, never>;
