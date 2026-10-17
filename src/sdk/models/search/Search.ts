/** Port of Models/Search/Search.swift. */
import type { SettingCategory } from '../category/Category';

export interface SettingsSearchRequest {
	query: string;
}

export interface SettingsSearchResponse {
	results: SettingCategory[];
	query: string;
	count: number;
}
