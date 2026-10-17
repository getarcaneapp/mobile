/** Port of Models/Swarm/SwarmServices.swift. */
import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';
import { D } from '../base/decoding';

/** A published port mapping for a swarm service endpoint. */
export interface SwarmServicePort {
	/** JSON key `protocol`. */
	protocolName: string;
	targetPort: number;
	publishedPort?: number;
	publishMode?: string;
}

export const SwarmServicePort = {
	decode(this: void, raw: unknown): SwarmServicePort {
		const o = D.object(raw, 'SwarmServicePort');
		return {
			protocolName: D.string(o, 'protocol'),
			targetPort: D.int(o, 'targetPort'),
			publishedPort: D.optInt(o, 'publishedPort'),
			publishMode: D.optString(o, 'publishMode')
		};
	},
	encode(this: void, value: SwarmServicePort): Record<string, unknown> {
		return {
			protocol: value.protocolName,
			targetPort: value.targetPort,
			publishedPort: value.publishedPort,
			publishMode: value.publishMode
		};
	}
} as const;

/** A mount configured on a swarm service task. */
export interface SwarmServiceMount {
	type: string;
	source?: string;
	target: string;
	readOnly?: boolean;
	volumeDriver?: string;
	volumeOptions?: Record<string, string>;
	devicePath?: string;
}

/**
 * Lightweight summary of a swarm service used in list views.
 *
 * Named `SwarmServiceSummary` to avoid collision with the `SwarmService`
 * facade in `services/SwarmService.ts`.
 */
export interface SwarmServiceSummary {
	id: string;
	name: string;
	image: string;
	mode: string;
	replicas: number;
	runningReplicas: number;
	ports: SwarmServicePort[];
	createdAt: ISODateString;
	updatedAt: ISODateString;
	labels?: Record<string, string>;
	stackName?: string;
	nodes: string[];
	networks: string[];
	mounts: SwarmServiceMount[];
}

export const SwarmServiceSummary = {
	/** Swift memberwise init (list fields default to `[]`). */
	make(
		this: void,
		args: Pick<
			SwarmServiceSummary,
			'id' | 'name' | 'image' | 'mode' | 'replicas' | 'runningReplicas' | 'createdAt' | 'updatedAt'
		> &
			Partial<SwarmServiceSummary>
	): SwarmServiceSummary {
		return {
			id: args.id,
			name: args.name,
			image: args.image,
			mode: args.mode,
			replicas: args.replicas,
			runningReplicas: args.runningReplicas,
			ports: args.ports ?? [],
			createdAt: args.createdAt,
			updatedAt: args.updatedAt,
			labels: args.labels,
			stackName: args.stackName,
			nodes: args.nodes ?? [],
			networks: args.networks ?? [],
			mounts: args.mounts ?? []
		};
	},
	/** Synthesized Swift decoding (every non-optional key is required). */
	decode(this: void, raw: unknown): SwarmServiceSummary {
		const o = D.object(raw, 'SwarmServiceSummary');
		return {
			id: D.string(o, 'id'),
			name: D.string(o, 'name'),
			image: D.string(o, 'image'),
			mode: D.string(o, 'mode'),
			replicas: D.int(o, 'replicas'),
			runningReplicas: D.int(o, 'runningReplicas'),
			ports: D.array(o, 'ports', SwarmServicePort.decode),
			createdAt: D.string(o, 'createdAt'),
			updatedAt: D.string(o, 'updatedAt'),
			labels: D.optRecord(o, 'labels', D.str),
			stackName: D.optString(o, 'stackName'),
			nodes: D.array(o, 'nodes', D.str),
			networks: D.array(o, 'networks', D.str),
			mounts: D.array(o, 'mounts', D.cast<SwarmServiceMount>)
		};
	},
	encode(this: void, value: SwarmServiceSummary): Record<string, unknown> {
		return { ...value, ports: value.ports.map(SwarmServicePort.encode) };
	}
} as const;

/** A single IPAM configuration entry for a service-attached network. */
export interface SwarmServiceNetworkIPAMConfig {
	subnet?: string;
	gateway?: string;
	ipRange?: string;
}

/** Details about a config-only network referenced by `configFrom`. */
export interface SwarmServiceNetworkConfigDetail {
	name: string;
	driver: string;
	scope: string;
	enableIPv4: boolean;
	enableIPv6: boolean;
	options?: Record<string, string>;
	ipv4Configs?: SwarmServiceNetworkIPAMConfig[];
	ipv6Configs?: SwarmServiceNetworkIPAMConfig[];
}

/** Enriched network info for a service's attached network. */
export interface SwarmServiceNetworkDetail {
	id: string;
	name: string;
	driver: string;
	scope: string;
	/** JSON key `internal`. */
	internalNetwork: boolean;
	attachable: boolean;
	ingress: boolean;
	enableIPv4: boolean;
	enableIPv6: boolean;
	configFrom?: string;
	configOnly: boolean;
	options?: Record<string, string>;
	ipamConfigs?: SwarmServiceNetworkIPAMConfig[];
	configNetwork?: SwarmServiceNetworkConfigDetail;
}

export const SwarmServiceNetworkDetail = {
	decode(this: void, raw: unknown): SwarmServiceNetworkDetail {
		const o = D.object(raw, 'SwarmServiceNetworkDetail');
		return {
			id: D.string(o, 'id'),
			name: D.string(o, 'name'),
			driver: D.string(o, 'driver'),
			scope: D.string(o, 'scope'),
			internalNetwork: D.boolean(o, 'internal'),
			attachable: D.boolean(o, 'attachable'),
			ingress: D.boolean(o, 'ingress'),
			enableIPv4: D.boolean(o, 'enableIPv4'),
			enableIPv6: D.boolean(o, 'enableIPv6'),
			configFrom: D.optString(o, 'configFrom'),
			configOnly: D.boolean(o, 'configOnly'),
			options: D.optRecord(o, 'options', D.str),
			ipamConfigs: D.optArray(o, 'ipamConfigs', D.cast<SwarmServiceNetworkIPAMConfig>),
			configNetwork: D.optNested(o, 'configNetwork', D.cast<SwarmServiceNetworkConfigDetail>)
		};
	},
	encode(this: void, value: SwarmServiceNetworkDetail): Record<string, unknown> {
		const { internalNetwork, ...rest } = value;
		return { ...rest, internal: internalNetwork };
	}
} as const;

/**
 * Full inspect payload for a swarm service. Docker SDK sub-blobs (spec,
 * endpoint, version, updateStatus) are preserved verbatim as JSON.
 */
export interface SwarmServiceInspect {
	id: string;
	version: JSONValue;
	createdAt: ISODateString;
	updatedAt: ISODateString;
	spec: JSONValue;
	endpoint: JSONValue;
	updateStatus?: JSONValue;
	nodes?: string[];
	networkDetails?: Record<string, SwarmServiceNetworkDetail>;
	mounts?: SwarmServiceMount[];
}

export const SwarmServiceInspect = {
	decode(this: void, raw: unknown): SwarmServiceInspect {
		const o = D.object(raw, 'SwarmServiceInspect');
		return {
			id: D.string(o, 'id'),
			version: (o['version'] ?? null) as JSONValue,
			createdAt: D.string(o, 'createdAt'),
			updatedAt: D.string(o, 'updatedAt'),
			spec: (o['spec'] ?? null) as JSONValue,
			endpoint: (o['endpoint'] ?? null) as JSONValue,
			updateStatus: D.optNested(o, 'updateStatus', D.cast<JSONValue>),
			nodes: D.optArray(o, 'nodes', D.str),
			networkDetails: D.optRecord(o, 'networkDetails', SwarmServiceNetworkDetail.decode),
			mounts: D.optArray(o, 'mounts', D.cast<SwarmServiceMount>)
		};
	},
	encode(this: void, value: SwarmServiceInspect): Record<string, unknown> {
		const details = value.networkDetails;
		return {
			...value,
			networkDetails:
				details === undefined
					? undefined
					: Object.fromEntries(
							Object.entries(details).map(([key, detail]) => [
								key,
								SwarmServiceNetworkDetail.encode(detail)
							])
						)
		};
	}
} as const;

/** Extra options used when creating a swarm service. */
export interface SwarmServiceCreateOptions {
	encodedRegistryAuth?: string;
	queryRegistry?: boolean;
}

/** Extra options used when updating a swarm service. */
export interface SwarmServiceUpdateOptions {
	encodedRegistryAuth?: string;
	registryAuthFrom?: string;
	rollback?: string;
	queryRegistry?: boolean;
}

/** Body for creating a swarm service. `spec` is the raw Docker ServiceSpec JSON. */
export interface SwarmServiceCreateRequest {
	spec: JSONValue;
	options?: SwarmServiceCreateOptions;
}

/** Body for updating a swarm service. */
export interface SwarmServiceUpdateRequest {
	version: number;
	spec: JSONValue;
	options?: SwarmServiceUpdateOptions;
}

/** Response for swarm service create. */
export interface SwarmServiceCreateResponse {
	id: string;
	warnings?: string[];
}

/** Response for swarm service update / rollback / scale. */
export interface SwarmServiceUpdateResponse {
	warnings?: string[];
}

/** Body for scaling a replicated swarm service. */
export interface SwarmServiceScaleRequest {
	replicas: number;
}
