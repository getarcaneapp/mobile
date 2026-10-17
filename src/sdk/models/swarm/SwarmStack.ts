import type { ISODateString } from '../base/date';

export interface SwarmStackSummary {
	id: string;
	name: string;
	namespace: string;
	services: number;
	createdAt: ISODateString;
	updatedAt: ISODateString;
}

export interface SwarmStackInspect {
	name: string;
	namespace: string;
	services: number;
	createdAt: ISODateString;
	updatedAt: ISODateString;
}

export interface SwarmSyncFile {
	relativePath: string;
	content: string;
}

export interface SwarmStackDeployRequest {
	name: string;
	composeContent: string;
	envContent?: string;
	files?: SwarmSyncFile[];
	withRegistryAuth?: boolean;
	prune?: boolean;
	resolveImage?: string;
	workingDir?: string;
}

export interface SwarmStackDeployResponse {
	name: string;
}

export interface SwarmStackSource {
	name: string;
	composeContent: string;
	envContent?: string;
	files?: SwarmSyncFile[];
}

export interface SwarmStackSourceUpdateRequest {
	composeContent: string;
	envContent?: string;
	files?: SwarmSyncFile[];
}

export interface SwarmStackRenderConfigRequest {
	name: string;
	composeContent: string;
	envContent?: string;
}

export interface SwarmStackRenderConfigResponse {
	name: string;
	renderedCompose: string;
	services: string[];
	networks: string[];
	volumes: string[];
	configs: string[];
	secrets: string[];
	warnings?: string[];
}

export const SwarmStackRenderConfigResponse = {
	make(
		args: Pick<SwarmStackRenderConfigResponse, 'name' | 'renderedCompose'> &
			Partial<SwarmStackRenderConfigResponse>
	): SwarmStackRenderConfigResponse {
		return {
			name: args.name,
			renderedCompose: args.renderedCompose,
			services: args.services ?? [],
			networks: args.networks ?? [],
			volumes: args.volumes ?? [],
			configs: args.configs ?? [],
			secrets: args.secrets ?? [],
			warnings: args.warnings
		};
	}
} as const;
