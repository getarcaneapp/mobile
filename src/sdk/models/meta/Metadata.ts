export interface ConfigMetadata {
	key: string;
	label: string;
	type: string;
	keywords?: string[];
	description?: string;
}

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
