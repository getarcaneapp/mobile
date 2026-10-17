/** Port of Models/Swarm/SwarmStack.swift. */
import type { ISODateString } from '../base/date';

/** A swarm stack as listed by the stacks endpoint. */
export interface SwarmStackSummary {
	id: string;
	name: string;
	namespace: string;
	services: number;
	createdAt: ISODateString;
	updatedAt: ISODateString;
}

/** A swarm stack inspect payload (no ID — stacks are keyed by name). */
export interface SwarmStackInspect {
	name: string;
	namespace: string;
	services: number;
	createdAt: ISODateString;
	updatedAt: ISODateString;
}

/** A file synced alongside a swarm stack compose deployment. */
export interface SwarmSyncFile {
	relativePath: string;
	/** Swift `Data`: base64-encoded file content. */
	content: string;
}

/** Body for `POST /environments/{id}/swarm/stacks` to deploy a stack. */
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

/** Result of `POST /environments/{id}/swarm/stacks`. */
export interface SwarmStackDeployResponse {
	name: string;
}

/** Persisted source for a deployed stack. */
export interface SwarmStackSource {
	name: string;
	composeContent: string;
	envContent?: string;
	files?: SwarmSyncFile[];
}

/** Update payload for the persisted stack source. */
export interface SwarmStackSourceUpdateRequest {
	composeContent: string;
	envContent?: string;
	files?: SwarmSyncFile[];
}

/** Render/validate request for a compose file before deploying. */
export interface SwarmStackRenderConfigRequest {
	name: string;
	composeContent: string;
	envContent?: string;
}

/** Result of rendering a compose config — normalized YAML plus referenced resources. */
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
	/** Swift memberwise init defaults (empty resource lists). */
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
