import { D } from '../base/decoding';
import type { EnvVariable } from '../env/Env';
import type { TemplateMetadata } from '../meta/Metadata';

export type TemplateSourceFilter = 'all' | 'local' | 'remote';

export const TemplateSourceFilter = {
	all: 'all',
	local: 'local',
	remote: 'remote',

	queryValue(filter: TemplateSourceFilter): string | undefined {
		switch (filter) {
			case 'all':
				return undefined;
			case 'local':
				return 'false';
			case 'remote':
				return 'true';
		}
	}
} as const;

export interface Template {
	id: string;
	name: string;
	description: string;
	content: string;
	envContent?: string;
	isCustom: boolean;
	isRemote: boolean;
	registryId?: string;
	registry?: TemplateRegistry;
	metadata?: TemplateMetadata;
}

export interface RemoteTemplate {
	id: string;
	name: string;
	description: string;
	version: string;
	author: string;
	composeUrl: string;
	envUrl: string;
	documentationUrl: string;
	tags: string[];
}

export const RemoteTemplate = {
	decode(this: void, raw: unknown): RemoteTemplate {
		const o = D.object(raw, 'RemoteTemplate');
		return {
			id: D.string(o, 'id'),
			name: D.string(o, 'name'),
			description: D.string(o, 'description'),
			version: D.string(o, 'version'),
			author: D.string(o, 'author'),
			composeUrl: D.string(o, 'compose_url'),
			envUrl: D.string(o, 'env_url'),
			documentationUrl: D.string(o, 'documentation_url'),
			tags: D.array(o, 'tags', D.str)
		};
	},

	encode(this: void, value: RemoteTemplate): Record<string, unknown> {
		return {
			id: value.id,
			name: value.name,
			description: value.description,
			version: value.version,
			author: value.author,
			compose_url: value.composeUrl,
			env_url: value.envUrl,
			documentation_url: value.documentationUrl,
			tags: value.tags
		};
	}
} as const;

export interface TemplateRegistry {
	id: string;
	name: string;
	description: string;
	url: string;
	enabled: boolean;
	lastFetchError?: string;
}

export interface RemoteTemplateRegistry {
	schema?: string;
	name: string;
	description: string;
	url: string;
	version: string;
	author: string;
	templates: RemoteTemplate[];
}

export const RemoteTemplateRegistry = {
	decode(this: void, raw: unknown): RemoteTemplateRegistry {
		const o = D.object(raw, 'RemoteTemplateRegistry');
		return {
			schema: D.optString(o, '$schema'),
			name: D.string(o, 'name'),
			description: D.string(o, 'description'),
			url: D.string(o, 'url'),
			version: D.string(o, 'version'),
			author: D.string(o, 'author'),
			templates: D.array(o, 'templates', RemoteTemplate.decode)
		};
	},

	encode(this: void, value: RemoteTemplateRegistry): Record<string, unknown> {
		return {
			$schema: value.schema,
			name: value.name,
			description: value.description,
			url: value.url,
			version: value.version,
			author: value.author,
			templates: value.templates.map(RemoteTemplate.encode)
		};
	}
} as const;

export interface TemplateContent {
	template: Template;
	content: string;
	envContent: string;
	services: string[];
	envVariables: EnvVariable[];
}

export interface CreateTemplate {
	name: string;
	description: string;
	content: string;
	envContent: string;
}

export const CreateTemplate = {
	make(args: {
		name: string;
		description?: string;
		content: string;
		envContent?: string;
	}): CreateTemplate {
		return {
			name: args.name,
			description: args.description ?? '',
			content: args.content,
			envContent: args.envContent ?? ''
		};
	}
} as const;

export interface UpdateTemplate {
	name: string;
	description: string;
	content: string;
	envContent: string;
}

export const UpdateTemplate = {
	make(args: {
		name: string;
		description?: string;
		content: string;
		envContent?: string;
	}): UpdateTemplate {
		return {
			name: args.name,
			description: args.description ?? '',
			content: args.content,
			envContent: args.envContent ?? ''
		};
	}
} as const;

export interface DefaultTemplates {
	composeTemplate: string;
	swarmStackTemplate: string;
	swarmStackEnvTemplate: string;
	envTemplate: string;
}

export interface SaveDefaultTemplates {
	composeContent: string;
	envContent: string;
}

export const SaveDefaultTemplates = {
	make(args: { composeContent: string; envContent?: string }): SaveDefaultTemplates {
		return { composeContent: args.composeContent, envContent: args.envContent ?? '' };
	}
} as const;

export interface CreateTemplateRegistry {
	name: string;
	url: string;
	description: string;
	enabled: boolean;
}

export const CreateTemplateRegistry = {
	make(args: {
		name: string;
		url: string;
		description?: string;
		enabled?: boolean;
	}): CreateTemplateRegistry {
		return {
			name: args.name,
			url: args.url,
			description: args.description ?? '',
			enabled: args.enabled ?? true
		};
	}
} as const;

export interface UpdateTemplateRegistry {
	name: string;
	url: string;
	description: string;
	enabled: boolean;
}

export const UpdateTemplateRegistry = {
	make(args: {
		name: string;
		url: string;
		description?: string;
		enabled?: boolean;
	}): UpdateTemplateRegistry {
		return {
			name: args.name,
			url: args.url,
			description: args.description ?? '',
			enabled: args.enabled ?? true
		};
	}
} as const;
