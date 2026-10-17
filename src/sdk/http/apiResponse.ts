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

export type EmptyBody = Record<string, never>;
