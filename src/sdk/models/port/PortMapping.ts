import { D } from '../base/decoding';

export interface PortMapping {
	id: string;
	containerId: string;
	containerName: string;
	hostIp?: string;
	hostPort?: number;
	containerPort: number;
	protocolName: string;
	isPublished: boolean;
}

export const PortMapping = {
	make(
		this: void,
		init: Omit<PortMapping, 'isPublished'> & { isPublished?: boolean }
	): PortMapping {
		return { ...init, isPublished: init.isPublished ?? false };
	},
	decode(this: void, raw: unknown): PortMapping {
		const o = D.object(raw, 'PortMapping');
		return {
			id: D.string(o, 'id'),
			containerId: D.string(o, 'containerId'),
			containerName: D.string(o, 'containerName'),
			hostIp: D.optString(o, 'hostIp'),
			hostPort: D.optInt(o, 'hostPort'),
			containerPort: D.int(o, 'containerPort'),
			protocolName: D.string(o, 'protocol'),
			isPublished: D.boolean(o, 'isPublished')
		};
	},
	encode(this: void, value: PortMapping): Record<string, unknown> {
		return {
			id: value.id,
			containerId: value.containerId,
			containerName: value.containerName,
			hostIp: value.hostIp,
			hostPort: value.hostPort,
			containerPort: value.containerPort,
			protocol: value.protocolName,
			isPublished: value.isPublished
		};
	}
} as const;
