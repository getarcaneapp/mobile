/** Port of Models/Meta/Metadata.swift. */

/** Metadata describing a configuration / setting field. */
export interface ConfigMetadata {
	key: string;
	label: string;
	type: string;
	keywords?: string[];
	description?: string;
}

/** Metadata associated with a template (URLs, tags, author etc.). */
export interface TemplateMetadata {
	version?: string;
	author?: string;
	tags?: string[];
	remoteUrl?: string;
	envUrl?: string;
	documentationUrl?: string;
	iconUrl?: string;
	updatedAt?: string;
}
