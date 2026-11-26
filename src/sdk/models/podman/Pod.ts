import type { ISODateString } from '../base/date';
import { D, object } from '../base/decoding';

export type PodAction = 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'kill';

export interface PodContainer {
	id: string;
	names: string;
	status: string;
	restartCount: number;
}

export const PodContainer = {
	decode(this: void, raw: unknown): PodContainer {
		const o = object(raw, 'PodContainer');
		return {
			id: D.string(o, 'id'),
			names: D.optString(o, 'names') ?? '',
			status: D.optString(o, 'status') ?? '',
			restartCount: D.optStringOrNumber(o, 'restartCount') ?? 0
		};
	}
} as const;

export interface Pod {
	id: string;
	name: string;
	namespace?: string;
	status: string;
	created: ISODateString;
	infraId?: string;
	cgroup?: string;
	labels?: Record<string, string>;
	networks?: string[];
	containers: PodContainer[];
	environmentId?: string;
}

export const Pod = {
	decode(this: void, raw: unknown): Pod {
		const o = object(raw, 'Pod');
		return {
			id: D.string(o, 'id'),
			name: D.optString(o, 'name') ?? '',
			namespace: D.optString(o, 'namespace') || undefined,
			status: D.optString(o, 'status') ?? '',
			created: D.optString(o, 'created') ?? '',
			infraId: D.optString(o, 'infraId') || undefined,
			cgroup: D.optString(o, 'cgroup') || undefined,
			labels: D.optRecord(o, 'labels', D.str),
			networks: D.optArray(o, 'networks', D.str),
			containers: D.optArray(o, 'containers', PodContainer.decode) ?? [],
			environmentId: D.optString(o, 'environmentId') || undefined
		};
	},
	displayName(this: void, pod: Pick<Pod, 'id' | 'name'>): string {
		return pod.name || pod.id.slice(0, 12);
	}
} as const;

export interface PodPortMapping {
	containerPort: number;
	hostPort?: number;
	hostIp?: string;
	protocol?: string;
	range?: number;
}

export const PodPortMapping = {
	decode(this: void, raw: unknown): PodPortMapping {
		const o = object(raw, 'PodPortMapping');
		return {
			containerPort: D.optStringOrNumber(o, 'containerPort') ?? 0,
			hostPort: D.optStringOrNumber(o, 'hostPort') || undefined,
			hostIp: D.optString(o, 'hostIp') || undefined,
			protocol: D.optString(o, 'protocol') || undefined,
			range: D.optStringOrNumber(o, 'range') || undefined
		};
	}
} as const;

export interface PodInspectContainer {
	id: string;
	name: string;
	state: string;
	image?: string;
	status?: string;
	created: ISODateString;
	exitCode: number;
	isInfra: boolean;
	ports: PodPortMapping[];
}

export const PodInspectContainer = {
	decode(this: void, raw: unknown): PodInspectContainer {
		const o = object(raw, 'PodInspectContainer');
		return {
			id: D.string(o, 'id'),
			name: D.optString(o, 'name') ?? '',
			state: D.optString(o, 'state') ?? '',
			image: D.optString(o, 'image') || undefined,
			status: D.optString(o, 'status') || undefined,
			created: D.optString(o, 'created') ?? '',
			exitCode: D.optStringOrNumber(o, 'exitCode') ?? 0,
			isInfra: D.optBoolean(o, 'isInfra') ?? false,
			ports: D.optArray(o, 'ports', PodPortMapping.decode) ?? []
		};
	}
} as const;

export interface PodMount {
	type: string;
	name?: string;
	source?: string;
	destination: string;
	rw: boolean;
}

export const PodMount = {
	decode(this: void, raw: unknown): PodMount {
		const o = object(raw, 'PodMount');
		return {
			type: D.optString(o, 'type') ?? '',
			name: D.optString(o, 'name') || undefined,
			source: D.optString(o, 'source') || undefined,
			destination: D.optString(o, 'destination') ?? '',
			rw: D.optBoolean(o, 'rw') ?? false
		};
	}
} as const;

export interface PodInspect {
	id: string;
	name: string;
	namespace?: string;
	created: ISODateString;
	state: string;
	exitPolicy?: string;
	restartPolicy?: string;
	hostname?: string;
	labels?: Record<string, string>;
	createInfra: boolean;
	infraContainerId?: string;
	sharedNamespaces: string[];
	numContainers: number;
	containers: PodInspectContainer[];
	cgroupParent?: string;
	cpusetCpus?: string;
	memoryLimit?: number;
	networks: string[];
	mounts: PodMount[];
}

export const PodInspect = {
	decode(this: void, raw: unknown): PodInspect {
		const o = object(raw, 'PodInspect');
		const infra = D.has(o, 'infraConfig') ? object(o.infraConfig, 'infraConfig') : undefined;
		return {
			id: D.string(o, 'id'),
			name: D.optString(o, 'name') ?? '',
			namespace: D.optString(o, 'namespace') || undefined,
			created: D.optString(o, 'created') ?? '',
			state: D.optString(o, 'state') ?? '',
			exitPolicy: D.optString(o, 'exitPolicy') || undefined,
			restartPolicy: D.optString(o, 'restartPolicy') || undefined,
			hostname: D.optString(o, 'hostname') || undefined,
			labels: D.optRecord(o, 'labels', D.str),
			createInfra: D.optBoolean(o, 'createInfra') ?? false,
			infraContainerId: D.optString(o, 'infraContainerId') || undefined,
			sharedNamespaces: D.optArray(o, 'sharedNamespaces', D.str) ?? [],
			numContainers: D.optStringOrNumber(o, 'numContainers') ?? 0,
			containers: D.optArray(o, 'containers', PodInspectContainer.decode) ?? [],
			cgroupParent: D.optString(o, 'cgroupParent') || undefined,
			cpusetCpus: D.optString(o, 'cpusetCpus') || undefined,
			memoryLimit: D.optStringOrNumber(o, 'memoryLimit') || undefined,
			networks: (infra ? D.optArray(infra, 'networks', D.str) : undefined) ?? [],
			mounts: D.optArray(o, 'mounts', PodMount.decode) ?? []
		};
	}
} as const;

export interface PodTop {
	titles: string[];
	processes: string[][];
}

export const PodTop = {
	decode(this: void, raw: unknown): PodTop {
		const o = object(raw, 'PodTop');
		return {
			titles: D.optArray(o, 'titles', D.str) ?? [],
			processes:
				D.optArray(o, 'processes', (row) =>
					Array.isArray(row) ? row.map((cell) => (typeof cell === 'string' ? cell : '')) : []
				) ?? []
		};
	}
} as const;

export interface PodPruneReport {
	id: string;
}

export const PodPruneReport = {
	decode(this: void, raw: unknown): PodPruneReport {
		const o = object(raw, 'PodPruneReport');
		return { id: D.optString(o, 'id') ?? '' };
	}
} as const;
