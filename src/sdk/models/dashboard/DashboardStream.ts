/** Port of Models/Dashboard/DashboardStream.swift. */
import { EnvironmentID } from '../../client/environment';
import type { ISODateString } from '../base/date';
import { D } from '../base/decoding';
import { DashboardSnapshot } from './Dashboard';

/** Event kinds emitted by the aggregated dashboard stream (`DashboardService.stream`). */
export type DashboardStreamEventType =
	| 'snapshot'
	| 'pending'
	| 'heartbeat'
	| 'error'
	| (string & {});

export const DashboardStreamEventType = {
	snapshot: 'snapshot',
	pending: 'pending',
	heartbeat: 'heartbeat',
	error: 'error',
	knownCases: ['snapshot', 'pending', 'heartbeat', 'error'] as const,
	isKnown(this: void, value: DashboardStreamEventType): boolean {
		return (DashboardStreamEventType.knownCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): DashboardStreamEventType {
		return raw;
	},
	rawValue(this: void, value: DashboardStreamEventType): string {
		return value;
	},
	decode(this: void, raw: unknown): DashboardStreamEventType {
		return D.str(raw);
	}
} as const;

/**
 * Classified failure reasons carried by dashboard stream `error` events.
 * The backend omits the field for unclassified errors.
 */
export type DashboardStreamErrorCode =
	/** The remote agent runs an older Arcane without the dashboard endpoint. */
	| 'agent_incompatible'
	/** Transport/network failure reaching the agent. */
	| 'unreachable'
	| (string & {});

export const DashboardStreamErrorCode = {
	agentIncompatible: 'agent_incompatible',
	unreachable: 'unreachable',
	knownCases: ['agent_incompatible', 'unreachable'] as const,
	isKnown(this: void, value: DashboardStreamErrorCode): boolean {
		return (DashboardStreamErrorCode.knownCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): DashboardStreamErrorCode {
		return raw;
	},
	rawValue(this: void, value: DashboardStreamErrorCode): string {
		return value;
	},
	decode(this: void, raw: unknown): DashboardStreamErrorCode {
		return D.str(raw);
	}
} as const;

/**
 * One line of the aggregated dashboard NDJSON stream. Snapshot payloads have
 * their container/image table rows trimmed server-side — only the aggregate
 * counts, action items, settings, and version info are populated.
 */
export interface DashboardStreamEvent {
	type: DashboardStreamEventType;
	/** JSON key `environmentId`. */
	environmentID?: string;
	snapshot?: DashboardSnapshot;
	error?: string;
	errorCode?: DashboardStreamErrorCode;
	timestamp: ISODateString;
}

export const DashboardStreamEvent = {
	/**
	 * Environment the event applies to; a missing/empty ID (local environment)
	 * normalizes to `EnvironmentID.localDocker`. Meaningless for heartbeats.
	 */
	resolvedEnvironmentID(this: void, value: DashboardStreamEvent): string {
		return value.environmentID ? value.environmentID : EnvironmentID.localDocker;
	},

	decode(this: void, raw: unknown): DashboardStreamEvent {
		const o = D.object(raw, 'DashboardStreamEvent');
		return {
			type: D.nested(o, 'type', DashboardStreamEventType.decode),
			environmentID: D.optString(o, 'environmentId'),
			snapshot: D.optNested(o, 'snapshot', DashboardSnapshot.decode),
			error: D.optString(o, 'error'),
			errorCode: D.optNested(o, 'errorCode', DashboardStreamErrorCode.decode),
			timestamp: D.string(o, 'timestamp')
		};
	},

	encode(this: void, value: DashboardStreamEvent): Record<string, unknown> {
		const { environmentID, ...rest } = value;
		return { ...rest, environmentId: environmentID };
	}
} as const;
