import { D, object } from '../base/decoding';
import { PodmanUnitStatus, type PodmanAutoUpdateMode } from './PodmanStatus';

export interface PodmanAutoUpdateOptions {
	dryRun?: boolean;
	rollback?: boolean;
	tlsVerify?: boolean;
	authfile?: string;
	filters?: Record<string, string[]>;
}

export interface PodmanAutoUpdateReport {
	containerId: string;
	containerName: string;
	imageName: string;
	policy: string;
	systemdUnit: string;
	updated: string;
}

export const PodmanAutoUpdateReport = {
	decode(this: void, raw: unknown): PodmanAutoUpdateReport {
		const o = object(raw, 'PodmanAutoUpdateReport');
		return {
			containerId: D.optString(o, 'containerId') ?? '',
			containerName: D.optString(o, 'containerName') ?? '',
			imageName: D.optString(o, 'imageName') ?? '',
			policy: D.optString(o, 'policy') ?? '',
			systemdUnit: D.optString(o, 'systemdUnit') ?? '',
			updated: D.optString(o, 'updated') ?? ''
		};
	}
} as const;

export interface PodmanAutoUpdateResult {
	mode: PodmanAutoUpdateMode;
	reports: PodmanAutoUpdateReport[];
	errors: string[];
	unit?: PodmanUnitStatus;
}

export const PodmanAutoUpdateResult = {
	decode(this: void, raw: unknown): PodmanAutoUpdateResult {
		const o = object(raw, 'PodmanAutoUpdateResult');
		return {
			mode: D.optString(o, 'mode') || 'unavailable',
			reports: D.optArray(o, 'reports', PodmanAutoUpdateReport.decode) ?? [],
			errors: D.optArray(o, 'errors', D.str) ?? [],
			unit: D.optNested(o, 'unit', PodmanUnitStatus.decode)
		};
	},
	updatedCount(this: void, result: PodmanAutoUpdateResult): number {
		return result.reports.filter((report) => report.updated.toLowerCase() === 'true').length;
	}
} as const;
