/** Port of Models/Category/Category.swift. */

/** Category metadata used by the settings UI. */
export interface SettingCategory {
	id: string;
	title: string;
	description: string;
	icon: string;
	url: string;
	keywords: string[];
	settings: SettingMetadata[];
	matchingSettings?: SettingMetadata[];
	relevanceScore?: number;
}

export const SettingCategory = {
	/** Swift init defaults (`keywords` / `settings` default to `[]`). */
	make(
		init: Omit<SettingCategory, 'keywords' | 'settings'> & {
			keywords?: string[];
			settings?: SettingMetadata[];
		}
	): SettingCategory {
		return { ...init, keywords: init.keywords ?? [], settings: init.settings ?? [] };
	}
} as const;

/** Setting-level metadata used by the settings UI. */
export interface SettingMetadata {
	key: string;
	label: string;
	type: string;
	keywords?: string[];
	description?: string;
}
