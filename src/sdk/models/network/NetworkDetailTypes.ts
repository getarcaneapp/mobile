export interface NetworkPeer {
	name: string;
	address: string;
}

export const NetworkPeer = {
	id(value: NetworkPeer): string {
		return `${value.name}:${value.address}`;
	}
} as const;

export interface NetworkServiceAttachment {
	name: string;
	vip?: string;
	ports: string[];
}

export const NetworkServiceAttachment = {
	id(value: NetworkServiceAttachment): string {
		return value.name;
	},
	make(init: { name: string; vip?: string; ports?: string[] }): NetworkServiceAttachment {
		return { name: init.name, vip: init.vip, ports: init.ports ?? [] };
	}
} as const;
