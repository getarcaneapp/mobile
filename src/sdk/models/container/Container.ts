import type { JSONValue } from '../../types/json';
import { D } from '../base/decoding';

export interface ContainerPort {
	ip?: string;
	privatePort: number;
	publicPort?: number;
	type: string;
}

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

export interface ContainerNetworkSettings {
	networks: Record<string, ContainerNetworkEndpoint>;
}

export const ContainerNetworkSettings = {
	make(this: void, init: Partial<ContainerNetworkSettings> = {}): ContainerNetworkSettings {
		return { networks: init.networks ?? {} };
	},

	decode(this: void, raw: unknown): ContainerNetworkSettings {
		const o = D.object(raw, 'ContainerNetworkSettings');
		return {
			networks: D.optRecord(o, 'networks', D.cast<ContainerNetworkEndpoint>) ?? {}
		};
	}
} as const;

export interface ContainerHostConfig {
	networkMode?: string;
	restartPolicy?: string;
	privileged?: boolean;
	autoRemove?: boolean;
	nanoCpus?: number;
	memory?: number;
}
