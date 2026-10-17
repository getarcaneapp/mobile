import type { ISODateString } from '../base/date';
import { D } from '../base/decoding';

export interface UpgradeCheckResult {
	canUpgrade: boolean;
	error: boolean;
	message: string;
}

export type EnvironmentUpdateJobStatus =
	| 'running'
	| 'pending_restart'
	| 'completed'
	| 'failed'
	| 'unknown';

export const EnvironmentUpdateJobStatus = {
	running: 'running',
	pendingRestart: 'pending_restart',
	completed: 'completed',
	failed: 'failed',
	unknown: 'unknown',

	decode(this: void, raw: unknown): EnvironmentUpdateJobStatus {
		const value = D.str(raw);
		switch (value) {
			case 'running':
			case 'pending_restart':
			case 'completed':
			case 'failed':
			case 'unknown':
				return value;
			default:
				return 'unknown';
		}
	}
} as const;

export type EnvironmentUpdateResultStatus =
	| 'pending'
	| 'updating'
	| 'updated'
	| 'up_to_date'
	| 'triggered'
	| 'skipped_offline'
	| 'failed'
	| 'unknown';

export const EnvironmentUpdateResultStatus = {
	pending: 'pending',
	updating: 'updating',
	updated: 'updated',
	upToDate: 'up_to_date',
	triggered: 'triggered',
	skippedOffline: 'skipped_offline',
	failed: 'failed',
	unknown: 'unknown',

	decode(this: void, raw: unknown): EnvironmentUpdateResultStatus {
		const value = D.str(raw);
		switch (value) {
			case 'pending':
			case 'updating':
			case 'updated':
			case 'up_to_date':
			case 'triggered':
			case 'skipped_offline':
			case 'failed':
			case 'unknown':
				return value;
			default:
				return 'unknown';
		}
	}
} as const;

export interface EnvironmentUpdateResult {
	environmentId: string;
	environmentName: string;
	status: EnvironmentUpdateResultStatus;
	fromVersion?: string;
	toVersion?: string;
	error?: string;
}

export const EnvironmentUpdateResult = {
	id(this: void, value: EnvironmentUpdateResult): string {
		return value.environmentId;
	},

	decode(this: void, raw: unknown): EnvironmentUpdateResult {
		const o = D.object(raw, 'EnvironmentUpdateResult');
		return {
			environmentId: D.string(o, 'environmentId'),
			environmentName: D.string(o, 'environmentName'),
			status: D.nested(o, 'status', EnvironmentUpdateResultStatus.decode),
			fromVersion: D.optString(o, 'fromVersion'),
			toVersion: D.optString(o, 'toVersion'),
			error: D.optString(o, 'error')
		};
	}
} as const;

export interface EnvironmentUpdateJob {
	id: string;
	createdAt?: ISODateString;
	updatedAt?: ISODateString;
	status: EnvironmentUpdateJobStatus;
	userId?: string;
	username?: string;
	managerVersionAtStart?: string;
	managerDigestAtStart?: string;
	managerTargetVersion?: string;
	results?: EnvironmentUpdateResult[];
	error?: string;
	completedAt?: ISODateString;
}

export const EnvironmentUpdateJob = {
	managerResult(this: void, value: EnvironmentUpdateJob): EnvironmentUpdateResult | undefined {
		return value.results?.find((result) => result.environmentId === '0');
	},

	isTerminal(this: void, value: EnvironmentUpdateJob): boolean {
		return value.status === 'completed' || value.status === 'failed';
	},

	decode(this: void, raw: unknown): EnvironmentUpdateJob {
		const o = D.object(raw, 'EnvironmentUpdateJob');
		return {
			id: D.string(o, 'id'),
			createdAt: D.optString(o, 'createdAt'),
			updatedAt: D.optString(o, 'updatedAt'),
			status: D.nested(o, 'status', EnvironmentUpdateJobStatus.decode),
			userId: D.optString(o, 'userId'),
			username: D.optString(o, 'username'),
			managerVersionAtStart: D.optString(o, 'managerVersionAtStart'),
			managerDigestAtStart: D.optString(o, 'managerDigestAtStart'),
			managerTargetVersion: D.optString(o, 'managerTargetVersion'),
			results: D.optArray(o, 'results', EnvironmentUpdateResult.decode),
			error: D.optString(o, 'error'),
			completedAt: D.optString(o, 'completedAt')
		};
	}
} as const;

export interface SystemContainerActionResult {
	started?: string[];
	stopped?: string[];
	failed?: string[];
	success: boolean;
	errors?: string[];
	activityID?: string;
}

export const SystemContainerActionResult = {
	make(this: void, args: Partial<SystemContainerActionResult> = {}): SystemContainerActionResult {
		return { ...args, success: args.success ?? false };
	},

	decode(this: void, raw: unknown): SystemContainerActionResult {
		const o = D.object(raw, 'SystemContainerActionResult');
		return {
			started: D.optArray(o, 'started', D.str),
			stopped: D.optArray(o, 'stopped', D.str),
			failed: D.optArray(o, 'failed', D.str),
			success: D.boolean(o, 'success'),
			errors: D.optArray(o, 'errors', D.str),
			activityID: D.optString(o, 'activityId')
		};
	},

	encode(this: void, value: SystemContainerActionResult): Record<string, unknown> {
		const { activityID, ...rest } = value;
		return { ...rest, activityId: activityID };
	}
} as const;
