/** Port of Models/Container/Container.swift. */
import type { JSONValue } from '../../types/json';
import { D } from '../base/decoding';

/** A port binding for a container. */
export interface ContainerPort {
	ip?: string;
	privatePort: number;
	publicPort?: number;
	type: string;
}

/** A volume mount for a container. */
export interface ContainerMount {
	type: string;
	name?: string;
	source?: string;
	destination: string;
	driver?: string;
	mode?: string;
	rw?: boolean;
	propagation?: string;
}

/** Network endpoint settings for a container. */
export interface ContainerNetworkEndpoint {
	ipamConfig?: JSONValue;
	links?: string[];
	aliases?: string[];
	macAddress?: string;
	driverOpts?: Record<string, string>;
	gwPriority?: number;
	networkId?: string;
	endpointId?: string;
	gateway?: string;
	ipAddress?: string;
	ipPrefixLen?: number;
	ipv6Gateway?: string;
	globalIPv6Address?: string;
	globalIPv6PrefixLen?: number;
	dnsNames?: string[];
}

/** Network configuration for a container. */
export interface ContainerNetworkSettings {
	networks: Record<string, ContainerNetworkEndpoint>;
}

export const ContainerNetworkSettings = {
	make(this: void, init: Partial<ContainerNetworkSettings> = {}): ContainerNetworkSettings {
		return { networks: init.networks ?? {} };
	},

	/** Swift `init(from:)`: a missing `networks` key decodes as `{}`. */
	decode(this: void, raw: unknown): ContainerNetworkSettings {
		const o = D.object(raw, 'ContainerNetworkSettings');
		return {
			networks: D.optRecord(o, 'networks', D.cast<ContainerNetworkEndpoint>) ?? {}
		};
	}
} as const;

/** Host configuration for a container. */
export interface ContainerHostConfig {
	networkMode?: string;
	restartPolicy?: string;
	privileged?: boolean;
	autoRemove?: boolean;
	nanoCpus?: number;
	memory?: number;
}
