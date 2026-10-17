/** Port of Models/ContainerRegistry/ContainerRegistry.swift. */
import type { ISODateString } from '../base/date';
import { D } from '../base/decoding';

export interface ContainerRegistry {
	id: string;
	url: string;
	username: string;
	description?: string;
	insecure: boolean;
	enabled: boolean;
	registryType: string;
	awsAccessKeyId?: string;
	awsRegion?: string;
	repositoryNames: string[];
	createdAt: ISODateString;
	updatedAt: ISODateString;
}

export const ContainerRegistry = {
	/** Swift `ContainerRegistry.init(...)`; `repositoryNames` defaults to `[]`. */
	make(
		this: void,
		init: Omit<ContainerRegistry, 'repositoryNames'> & { repositoryNames?: string[] }
	): ContainerRegistry {
		return { ...init, repositoryNames: init.repositoryNames ?? [] };
	},

	/** Swift `ContainerRegistry.init(from:)`: missing `repositoryNames` → `[]`. */
	decode(this: void, raw: unknown): ContainerRegistry {
		const o = D.object(raw, 'ContainerRegistry');
		return {
			id: D.string(o, 'id'),
			url: D.string(o, 'url'),
			username: D.string(o, 'username'),
			description: D.optString(o, 'description'),
			insecure: D.boolean(o, 'insecure'),
			enabled: D.boolean(o, 'enabled'),
			registryType: D.string(o, 'registryType'),
			awsAccessKeyId: D.optString(o, 'awsAccessKeyId'),
			awsRegion: D.optString(o, 'awsRegion'),
			repositoryNames: D.optArray(o, 'repositoryNames', D.str) ?? [],
			createdAt: D.string(o, 'createdAt'),
			updatedAt: D.string(o, 'updatedAt')
		};
	}
} as const;

export interface CreateContainerRegistry {
	url: string;
	username?: string;
	token?: string;
	description?: string;
	insecure?: boolean;
	enabled?: boolean;
	registryType?: string;
	awsAccessKeyId?: string;
	awsSecretAccessKey?: string;
	awsRegion?: string;
	repositoryNames?: string[];
}

export interface UpdateContainerRegistry {
	url?: string;
	username?: string;
	token?: string;
	description?: string;
	insecure?: boolean;
	enabled?: boolean;
	registryType?: string;
	awsAccessKeyId?: string;
	awsSecretAccessKey?: string;
	awsRegion?: string;
	repositoryNames?: string[];
}

export interface ContainerRegistryPullUsageResponse {
	registries: ContainerRegistryPullUsage[];
}

export interface ContainerRegistryPullUsage {
	registryId: string;
	provider: string;
	registry: string;
	displayName: string;
	repository?: string;
	limit?: number;
	remaining?: number;
	used?: number;
	windowSeconds?: number;
	observedPulls: number;
	authMethod: string;
	authUsername?: string;
	source?: string;
	checkedAt: ISODateString;
	error?: string;
}

/**
 * Registry payload synced from a manager to an agent.
 *
 * Swift keeps `repositoryNames: [String]` plus a private
 * `encodesRepositoryNames` flag (set when the key was decoded, passed to
 * `init`, or assigned). In TS that flag is the field's presence:
 * `repositoryNames` is `undefined` when it would not be encoded (Swift would
 * read `[]`), and any assigned array is encoded.
 */
export interface ContainerRegistrySync {
	id: string;
	url: string;
	username: string;
	token: string;
	description?: string;
	insecure: boolean;
	enabled: boolean;
	registryType: string;
	awsAccessKeyId?: string;
	awsSecretAccessKey?: string;
	awsRegion?: string;
	repositoryNames?: string[];
	createdAt: ISODateString;
	updatedAt: ISODateString;
}

export const ContainerRegistrySync = {
	/** Swift `ContainerRegistrySync.init(from:)`. */
	decode(this: void, raw: unknown): ContainerRegistrySync {
		const o = D.object(raw, 'ContainerRegistrySync');
		return {
			id: D.string(o, 'id'),
			url: D.string(o, 'url'),
			username: D.string(o, 'username'),
			token: D.string(o, 'token'),
			description: D.optString(o, 'description'),
			insecure: D.boolean(o, 'insecure'),
			enabled: D.boolean(o, 'enabled'),
			registryType: D.string(o, 'registryType'),
			awsAccessKeyId: D.optString(o, 'awsAccessKeyId'),
			awsSecretAccessKey: D.optString(o, 'awsSecretAccessKey'),
			awsRegion: D.optString(o, 'awsRegion'),
			repositoryNames: D.contains(o, 'repositoryNames')
				? (D.optArray(o, 'repositoryNames', D.str) ?? [])
				: undefined,
			createdAt: D.string(o, 'createdAt'),
			updatedAt: D.string(o, 'updatedAt')
		};
	},

	/** Swift `encode(to:)`: `repositoryNames` only when set. */
	encode(this: void, value: ContainerRegistrySync): Record<string, unknown> {
		return {
			id: value.id,
			url: value.url,
			username: value.username,
			token: value.token,
			description: value.description,
			insecure: value.insecure,
			enabled: value.enabled,
			registryType: value.registryType,
			awsAccessKeyId: value.awsAccessKeyId,
			awsSecretAccessKey: value.awsSecretAccessKey,
			awsRegion: value.awsRegion,
			...(value.repositoryNames !== undefined ? { repositoryNames: value.repositoryNames } : {}),
			createdAt: value.createdAt,
			updatedAt: value.updatedAt
		};
	}
} as const;

export interface ContainerRegistrySyncRequest {
	registries: ContainerRegistrySync[];
}

export const ContainerRegistrySyncRequest = {
	decode(raw: unknown): ContainerRegistrySyncRequest {
		const o = D.object(raw, 'ContainerRegistrySyncRequest');
		return { registries: D.array(o, 'registries', ContainerRegistrySync.decode) };
	},

	encode(value: ContainerRegistrySyncRequest): Record<string, unknown> {
		return { registries: value.registries.map(ContainerRegistrySync.encode) };
	}
} as const;

export interface ContainerRegistryCredential {
	url: string;
	username: string;
	token: string;
	enabled: boolean;
}
