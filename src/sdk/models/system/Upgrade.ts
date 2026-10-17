/** Port of Models/System/Upgrade.swift. */
import type { ISODateString } from '../base/date';
import { D } from '../base/decoding';

/** Result of the system upgrade-availability check. */
export interface UpgradeCheckResult {
	canUpgrade: boolean;
	error: boolean;
	message: string;
}

/**
 * Status of a fleet-wide update-all job. Unrecognised server values decode
 * to `"unknown"` (Swift's `.unknown` fallback case).
 */
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
	/** Fallback for status values introduced by newer servers. */
	unknown: 'unknown',

	/** Swift `init(from:)`: unrecognised values become `"unknown"`. */
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

/**
 * Per-environment status within a fleet-wide update-all job. Unrecognised
 * server values decode to `"unknown"`.
 */
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
	/** Fallback for status values introduced by newer servers. */
	unknown: 'unknown',

	/** Swift `init(from:)`: unrecognised values become `"unknown"`. */
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

/**
 * Outcome of one environment inside a fleet-wide update-all job. The manager
 * itself appears as `environmentId == "0"` and is upgraded last.
 */
export interface EnvironmentUpdateResult {
	environmentId: string;
	environmentName: string;
	status: EnvironmentUpdateResultStatus;
	fromVersion?: string;
	toVersion?: string;
	error?: string;
}

export const EnvironmentUpdateResult = {
	/** Swift `Identifiable.id`. */
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

/**
 * A fleet-wide Arcane update-all job: agents are upgraded first, then the
 * manager restarts (`pending_restart`) and the job is finalized on next boot.
 */
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
	/** The manager's own row (`environmentId == "0"`), if present. */
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

/** Result of a system-level container batch action (start/stop/etc.). */
export interface SystemContainerActionResult {
	started?: string[];
	stopped?: string[];
	failed?: string[];
	success: boolean;
	errors?: string[];
	/** JSON key `activityId`. */
	activityID?: string;
}

export const SystemContainerActionResult = {
	/** Swift memberwise init defaults (`success: false`). */
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
