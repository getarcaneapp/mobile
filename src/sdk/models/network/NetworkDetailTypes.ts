/** Port of Models/Network/NetworkDetailTypes.swift. */

/** A manager or worker participating in an overlay network. */
export interface NetworkPeer {
	name: string;
	address: string;
}

export const NetworkPeer = {
	/** Swift `id`: `"<name>:<address>"`. */
	id(value: NetworkPeer): string {
		return `${value.name}:${value.address}`;
	}
} as const;

/** A Swarm service attached to a network. */
export interface NetworkServiceAttachment {
	name: string;
	vip?: string;
	ports: string[];
}

export const NetworkServiceAttachment = {
	/** Swift `id`: the service name. */
	id(value: NetworkServiceAttachment): string {
		return value.name;
	},
	make(init: { name: string; vip?: string; ports?: string[] }): NetworkServiceAttachment {
		return { name: init.name, vip: init.vip, ports: init.ports ?? [] };
	}
} as const;
