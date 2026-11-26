import { D, object } from '../base/decoding';

export type PodmanAutoUpdateMode = 'rest' | 'systemd' | 'unavailable' | (string & {});

export type PodmanSystemdScope = 'system' | 'user' | (string & {});

export interface PodmanStatus {
	detected: boolean;
	podCount: number;
	version?: string;
	apiVersion?: string;
	rootless: boolean;
	quadletsSupported: boolean;
	quadletAppsSupported: boolean;
	autoUpdateMode: PodmanAutoUpdateMode;
	systemdAvailable: boolean;
	systemdScope?: PodmanSystemdScope;
	systemdReason?: string;
	reason?: string;
}

export const PodmanStatus = {
	decode(this: void, raw: unknown): PodmanStatus {
		const o = object(raw, 'PodmanStatus');
		return {
			detected: D.optBoolean(o, 'detected') ?? false,
			podCount: D.optStringOrNumber(o, 'podCount') ?? 0,
			version: D.optString(o, 'version') || undefined,
			apiVersion: D.optString(o, 'apiVersion') || undefined,
			rootless: D.optBoolean(o, 'rootless') ?? false,
			quadletsSupported: D.optBoolean(o, 'quadletsSupported') ?? false,
			quadletAppsSupported: D.optBoolean(o, 'quadletAppsSupported') ?? false,
			autoUpdateMode: D.optString(o, 'autoUpdateMode') || 'unavailable',
			systemdAvailable: D.optBoolean(o, 'systemdAvailable') ?? false,
			systemdScope: D.optString(o, 'systemdScope') || undefined,
			systemdReason: D.optString(o, 'systemdReason') || undefined,
			reason: D.optString(o, 'reason') || undefined
		};
	},
	supportsAutoUpdate(this: void, status: PodmanStatus): boolean {
		return status.autoUpdateMode === 'rest' || status.autoUpdateMode === 'systemd';
	}
} as const;

export interface PodmanUnitStatus {
	name: string;
	description?: string;
	loadState: string;
	activeState: string;
	subState: string;
}

export const PodmanUnitStatus = {
	decode(this: void, raw: unknown): PodmanUnitStatus {
		const o = object(raw, 'PodmanUnitStatus');
		return {
			name: D.optString(o, 'name') ?? '',
			description: D.optString(o, 'description') || undefined,
			loadState: D.optString(o, 'loadState') ?? '',
			activeState: D.optString(o, 'activeState') ?? '',
			subState: D.optString(o, 'subState') ?? ''
		};
	}
} as const;
