import { D, object } from '../base/decoding';

export type KubeGenerateType = 'pod' | 'service' | 'deployment' | 'daemonset' | 'job';

export interface KubePlayRequest {
	yaml: string;
	start?: boolean;
	replace?: boolean;
	networks?: string[];
}

export interface KubeDownRequest {
	yaml: string;
	force?: boolean;
}

export interface KubeGenerateRequest {
	names: string[];
	type?: KubeGenerateType;
	service?: boolean;
}

export interface KubeGenerateResponse {
	yaml: string;
}

export const KubeGenerateResponse = {
	decode(this: void, raw: unknown): KubeGenerateResponse {
		const o = object(raw, 'KubeGenerateResponse');
		return { yaml: D.optString(o, 'yaml') ?? '' };
	}
} as const;

export interface KubePlayPod {
	id: string;
	containers: string[];
	initContainers: string[];
	logs: string[];
	containerErrors: string[];
}

const strings = (o: Record<string, unknown>, key: string) => D.optArray(o, key, D.str) ?? [];

export const KubePlayPod = {
	decode(this: void, raw: unknown): KubePlayPod {
		const o = object(raw, 'KubePlayPod');
		return {
			id: D.optString(o, 'id') ?? '',
			containers: strings(o, 'containers'),
			initContainers: strings(o, 'initContainers'),
			logs: strings(o, 'logs'),
			containerErrors: strings(o, 'containerErrors')
		};
	}
} as const;

export interface KubePlayReport {
	pods: KubePlayPod[];
	volumes: string[];
	serviceContainerId?: string;
	exitCode?: number;
}

export const KubePlayReport = {
	decode(this: void, raw: unknown): KubePlayReport {
		const o = object(raw, 'KubePlayReport');
		return {
			pods: D.optArray(o, 'pods', KubePlayPod.decode) ?? [],
			volumes:
				D.optArray(o, 'volumes', (volume) => D.optString(object(volume, 'volume'), 'name') ?? '') ??
				[],
			serviceContainerId: D.optString(o, 'serviceContainerId') || undefined,
			exitCode: D.optStringOrNumber(o, 'exitCode')
		};
	},
	hasErrors(this: void, report: KubePlayReport): boolean {
		return report.pods.some((pod) => pod.containerErrors.length > 0);
	},
	lines(this: void, report: KubePlayReport): string[] {
		return [
			...report.pods.flatMap((pod) => [
				`Pod ${pod.id.slice(0, 12)}: ${pod.containers.length} ${pod.containers.length === 1 ? 'container' : 'containers'}`,
				...pod.containerErrors
			]),
			...report.volumes.filter((name) => name !== '').map((name) => `Volume ${name}`)
		];
	}
} as const;

export interface KubeDownReport {
	stopped: string[];
	removed: string[];
}

export const KubeDownReport = {
	decode(this: void, raw: unknown): KubeDownReport {
		const o = object(raw, 'KubeDownReport');
		const ids = (key: string) =>
			D.optArray(o, key, (pod) => D.optString(object(pod, key), 'id') ?? '') ?? [];
		return { stopped: ids('stopReport'), removed: ids('rmReport') };
	}
} as const;
