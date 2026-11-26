import type { ISODateString } from '../base/date';
import { D, object } from '../base/decoding';
import { PodmanUnitStatus } from './PodmanStatus';

export type QuadletAction = 'start' | 'stop' | 'restart';

export type QuadletType =
	| 'container'
	| 'pod'
	| 'kube'
	| 'network'
	| 'volume'
	| 'image'
	| 'build'
	| 'artifact'
	| (string & {});

export const QuadletType = {
	knownCases: [
		'container',
		'pod',
		'kube',
		'network',
		'volume',
		'image',
		'build',
		'artifact'
	] as const,
	fromFileName(this: void, name: string): QuadletType | undefined {
		const dot = name.lastIndexOf('.');
		if (dot <= 0 || dot === name.length - 1) return undefined;
		const extension = name.slice(dot + 1).toLowerCase();
		return (QuadletType.knownCases as readonly string[]).includes(extension)
			? extension
			: undefined;
	}
} as const;

export interface PodmanContainer {
	id: string;
	names: string[];
	image: string;
	state: string;
	status?: string;
	created: ISODateString;
	exitCode: number;
	isInfra: boolean;
	pod?: string;
	podName?: string;
}

export const PodmanContainer = {
	decode(this: void, raw: unknown): PodmanContainer {
		const o = object(raw, 'PodmanContainer');
		return {
			id: D.string(o, 'id'),
			names: D.optArray(o, 'names', D.str) ?? [],
			image: D.optString(o, 'image') ?? '',
			state: D.optString(o, 'state') ?? '',
			status: D.optString(o, 'status') || undefined,
			created: D.optString(o, 'created') ?? '',
			exitCode: D.optStringOrNumber(o, 'exitCode') ?? 0,
			isInfra: D.optBoolean(o, 'isInfra') ?? false,
			pod: D.optString(o, 'pod') || undefined,
			podName: D.optString(o, 'podName') || undefined
		};
	},
	displayName(this: void, container: PodmanContainer): string {
		return container.names[0]?.replace(/^\//, '') || container.id.slice(0, 12);
	}
} as const;

export interface QuadletDetail {
	name: string;
	unitName: string;
	path: string;
	status: string;
	app?: string;
	type: QuadletType;
	template: boolean;
	unitStatus?: PodmanUnitStatus;
	containers: PodmanContainer[];
	environmentId?: string;
}

export const QuadletDetail = {
	decode(this: void, raw: unknown): QuadletDetail {
		const o = object(raw, 'QuadletDetail');
		const name = D.string(o, 'name');
		return {
			name,
			unitName: D.optString(o, 'unitName') ?? '',
			path: D.optString(o, 'path') ?? '',
			status: D.optString(o, 'status') ?? '',
			app: D.optString(o, 'app') || undefined,
			type: D.optString(o, 'type') || QuadletType.fromFileName(name) || 'container',
			template: D.optBoolean(o, 'template') ?? false,
			unitStatus: D.optNested(o, 'unitStatus', PodmanUnitStatus.decode),
			containers: D.optArray(o, 'containers', PodmanContainer.decode) ?? [],
			environmentId: D.optString(o, 'environmentId') || undefined
		};
	},
	state(this: void, quadlet: Pick<QuadletDetail, 'status' | 'unitStatus'>): string {
		return quadlet.unitStatus?.activeState || quadlet.status;
	}
} as const;

export interface QuadletFile {
	name: string;
	content: string;
}

export const QuadletFile = {
	decode(this: void, raw: unknown): QuadletFile {
		const o = object(raw, 'QuadletFile');
		return { name: D.optString(o, 'name') ?? '', content: D.optString(o, 'content') ?? '' };
	}
} as const;

export interface QuadletInstallRequest {
	name: string;
	content: string;
	extraFiles?: QuadletFile[];
	app?: string;
}

export interface QuadletUpdateRequest {
	content: string;
	extraFiles?: QuadletFile[];
}

export interface QuadletInstallReport {
	installedQuadlets: Record<string, string>;
	quadletErrors: Record<string, string>;
}

export const QuadletInstallReport = {
	decode(this: void, raw: unknown): QuadletInstallReport {
		const o = object(raw, 'QuadletInstallReport');
		return {
			installedQuadlets: D.optRecord(o, 'installedQuadlets', D.str) ?? {},
			quadletErrors: D.optRecord(o, 'quadletErrors', D.str) ?? {}
		};
	},
	firstError(this: void, report: QuadletInstallReport): string | undefined {
		const [name, message] = Object.entries(report.quadletErrors)[0] ?? [];
		return name === undefined ? undefined : `${name}: ${message}`;
	}
} as const;

export interface QuadletRemoveReport {
	removed: string[];
	errors: Record<string, string>;
}

export const QuadletRemoveReport = {
	decode(this: void, raw: unknown): QuadletRemoveReport {
		const o = object(raw, 'QuadletRemoveReport');
		return {
			removed: D.optArray(o, 'removed', D.str) ?? [],
			errors: D.optRecord(o, 'errors', D.str) ?? {}
		};
	}
} as const;
