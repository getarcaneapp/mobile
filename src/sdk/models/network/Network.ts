import type { ISODateString } from '../base/date';
import type { PaginationResponse } from '../base/pagination';
import { D } from '../base/decoding';
import { JSONValue, type JSONObject } from '../../types/json';
import type { NetworkPeer, NetworkServiceAttachment } from './NetworkDetailTypes';

const jsonValue = (raw: unknown): JSONValue => (raw ?? null) as JSONValue;

export interface NetworkSummary {
	id: string;
	name: string;
	driver: string;
	scope: string;
	created: ISODateString;
	options: Record<string, string>;
	labels: Record<string, string>;
	inUse: boolean;
	isDefault: boolean;
}

export const NetworkSummary = {
	make(
		this: void,
		init: Pick<NetworkSummary, 'id' | 'name' | 'driver' | 'scope' | 'created'> &
			Partial<NetworkSummary>
	): NetworkSummary {
		return {
			...init,
			options: init.options ?? {},
			labels: init.labels ?? {},
			inUse: init.inUse ?? false,
			isDefault: init.isDefault ?? false
		};
	},
	decode(this: void, raw: unknown): NetworkSummary {
		const o = D.object(raw, 'NetworkSummary');
		return {
			id: D.string(o, 'id'),
			name: D.string(o, 'name'),
			driver: D.string(o, 'driver'),
			scope: D.string(o, 'scope'),
			created: D.string(o, 'created'),
			options: D.optRecord(o, 'options', D.str) ?? {},
			labels: D.optRecord(o, 'labels', D.str) ?? {},
			inUse: D.boolean(o, 'inUse'),
			isDefault: D.boolean(o, 'isDefault')
		};
	}
} as const;

export interface NetworkUsageCounts {
	inuse: number;
	unused: number;
	total: number;
}

export interface IPAMConfig {
	subnet?: string;
	gateway?: string;
	ipRange?: string;
	auxAddress?: Record<string, string>;
}

export interface IPAM {
	driver?: string;
	options?: Record<string, string>;
	config?: IPAMConfig[];
}

export interface NetworkContainerEndpoint {
	id: string;
	name: string;
	endpointId: string;
	ipv4Address: string;
	ipv6Address: string;
	macAddress: string;
}

export const NetworkContainerEndpoint = {
	make(
		init: Pick<NetworkContainerEndpoint, 'id' | 'name' | 'endpointId'> &
			Partial<NetworkContainerEndpoint>
	): NetworkContainerEndpoint {
		return {
			...init,
			ipv4Address: init.ipv4Address ?? '',
			ipv6Address: init.ipv6Address ?? '',
			macAddress: init.macAddress ?? ''
		};
	}
} as const;

export interface NetworkInspect {
	id: string;
	name: string;
	driver: string;
	scope: string;
	created: ISODateString;
	enableIPv4: boolean;
	enableIPv6: boolean;
	ipam: IPAM;
	internal: boolean;
	attachable: boolean;
	ingress: boolean;
	configFrom?: Record<string, JSONValue>;
	configOnly: boolean;
	containers: Record<string, JSONValue>;
	options: Record<string, string>;
	labels: Record<string, string>;
	peers?: JSONValue[];
	services?: Record<string, JSONValue>;
	containersList: NetworkContainerEndpoint[];
}

function stringInternal(object: JSONObject, keys: string[]): string | undefined {
	for (const key of keys) {
		const value = JSONValue.stringValue(object[key]);
		if (value === undefined || value === '') continue;
		return value;
	}
	return undefined;
}

function stringArrayInternal(object: JSONObject, keys: string[]): string[] {
	for (const key of keys) {
		const value = object[key];
		if (!Array.isArray(value)) continue;
		return value.map(JSONValue.stringValue).filter((v): v is string => v !== undefined);
	}
	return [];
}

export const NetworkInspect = {
	make(
		this: void,
		init: Pick<NetworkInspect, 'id' | 'name' | 'driver' | 'scope' | 'created' | 'ipam'> &
			Partial<NetworkInspect>
	): NetworkInspect {
		return {
			...init,
			enableIPv4: init.enableIPv4 ?? false,
			enableIPv6: init.enableIPv6 ?? false,
			internal: init.internal ?? false,
			attachable: init.attachable ?? false,
			ingress: init.ingress ?? false,
			configOnly: init.configOnly ?? false,
			containers: init.containers ?? {},
			options: init.options ?? {},
			labels: init.labels ?? {},
			containersList: init.containersList ?? []
		};
	},
	decode(this: void, raw: unknown): NetworkInspect {
		const o = D.object(raw, 'NetworkInspect');
		return {
			id: D.string(o, 'id'),
			name: D.string(o, 'name'),
			driver: D.string(o, 'driver'),
			scope: D.string(o, 'scope'),
			created: D.string(o, 'created'),
			enableIPv4: D.boolean(o, 'enableIPv4'),
			enableIPv6: D.boolean(o, 'enableIPv6'),
			ipam: D.nested(o, 'ipam', (v) => D.cast<IPAM>(D.object(v, 'IPAM'))),
			internal: D.boolean(o, 'internal'),
			attachable: D.boolean(o, 'attachable'),
			ingress: D.boolean(o, 'ingress'),
			configFrom: D.optRecord(o, 'configFrom', jsonValue),
			configOnly: D.boolean(o, 'configOnly'),
			containers: D.optRecord(o, 'containers', jsonValue) ?? {},
			options: D.optRecord(o, 'options', D.str) ?? {},
			labels: D.optRecord(o, 'labels', D.str) ?? {},
			peers: D.optArray(o, 'peers', jsonValue),
			services: D.optRecord(o, 'services', jsonValue),
			containersList: D.array(o, 'containersList', D.cast<NetworkContainerEndpoint>)
		};
	},

	peerList(this: void, value: NetworkInspect): NetworkPeer[] {
		const result: NetworkPeer[] = [];
		for (const peer of value.peers ?? []) {
			if (!JSONValue.isObject(peer)) continue;
			const name = stringInternal(peer, ['Name', 'name']);
			const address = stringInternal(peer, ['IP', 'ip']);
			if (name === undefined || address === undefined) continue;
			result.push({ name, address });
		}
		return result;
	},

	serviceList(this: void, value: NetworkInspect): NetworkServiceAttachment[] {
		if (value.services === undefined) return [];
		const result: NetworkServiceAttachment[] = [];
		for (const [name, service] of Object.entries(value.services)) {
			if (!JSONValue.isObject(service)) continue;
			result.push({
				name,
				vip: stringInternal(service, ['VIP', 'vip']),
				ports: stringArrayInternal(service, ['Ports', 'ports'])
			});
		}
		return result.sort((a, b) =>
			a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
		);
	}
} as const;

export interface NetworkCreateOptions {
	driver?: string;
	checkDuplicate?: boolean;
	internal?: boolean;
	attachable?: boolean;
	ingress?: boolean;
	ipam?: IPAM;
	enableIPv6?: boolean;
	options?: Record<string, string>;
	labels?: Record<string, string>;
}

export interface NetworkCreateRequest {
	name: string;
	options: NetworkCreateOptions;
}

export const NetworkCreateRequest = {
	make(init: { name: string; options?: NetworkCreateOptions }): NetworkCreateRequest {
		return { name: init.name, options: init.options ?? {} };
	}
} as const;

export interface NetworkCreateResponse {
	id: string;
	warning?: string;
	activityID?: string;
}

export const NetworkCreateResponse = {
	decode(this: void, raw: unknown): NetworkCreateResponse {
		const o = D.object(raw, 'NetworkCreateResponse');
		return {
			id: D.string(o, 'id'),
			warning: D.optString(o, 'warning'),
			activityID: D.optString(o, 'activityId')
		};
	},
	encode(this: void, value: NetworkCreateResponse): Record<string, unknown> {
		return { id: value.id, warning: value.warning, activityId: value.activityID };
	}
} as const;

export interface NetworkPruneReport {
	networksDeleted: string[];
	spaceReclaimed: number;
	activityID?: string;
}

export const NetworkPruneReport = {
	decode(this: void, raw: unknown): NetworkPruneReport {
		const o = D.object(raw, 'NetworkPruneReport');
		return {
			networksDeleted: D.array(o, 'networksDeleted', D.str),
			spaceReclaimed: D.number(o, 'spaceReclaimed'),
			activityID: D.optString(o, 'activityId')
		};
	},
	encode(this: void, value: NetworkPruneReport): Record<string, unknown> {
		return {
			networksDeleted: value.networksDeleted,
			spaceReclaimed: value.spaceReclaimed,
			activityId: value.activityID
		};
	}
} as const;

export interface NetworkListPage {
	success: boolean;
	data: NetworkSummary[];
	counts: NetworkUsageCounts;
	pagination: PaginationResponse;
}

export const NetworkListPage = {
	decode(raw: unknown): NetworkListPage {
		const o = D.object(raw, 'NetworkListPage');
		return {
			success: D.boolean(o, 'success'),
			data: D.array(o, 'data', NetworkSummary.decode),
			counts: D.nested(o, 'counts', D.cast<NetworkUsageCounts>),
			pagination: D.nested(o, 'pagination', D.cast<PaginationResponse>)
		};
	}
} as const;
