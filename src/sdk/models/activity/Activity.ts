/** Port of Models/Activity/Activity.swift. */
import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';
import { D } from '../base/decoding';

// MARK: - ActivityStatus

export type ActivityStatus =
	| 'queued'
	| 'running'
	| 'success'
	| 'failed'
	| 'cancelled'
	| (string & {});

const activityStatusCases = ['queued', 'running', 'success', 'failed', 'cancelled'] as const;

export const ActivityStatus = {
	queued: 'queued',
	running: 'running',
	success: 'success',
	failed: 'failed',
	cancelled: 'cancelled',
	knownCases: activityStatusCases,
	isKnown(this: void, value: ActivityStatus): value is (typeof activityStatusCases)[number] {
		return (activityStatusCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): ActivityStatus {
		return raw;
	},
	rawValue(this: void, value: ActivityStatus): string {
		return value;
	},
	decode(this: void, raw: unknown): ActivityStatus {
		return D.str(raw);
	}
} as const;

// MARK: - ActivityType

export type ActivityType =
	| 'image_pull'
	| 'image_build'
	| 'image_update_check'
	| 'project_pull'
	| 'project_build'
	| 'project_deploy'
	| 'project_redeploy'
	| 'project_down'
	| 'project_restart'
	| 'project_destroy'
	| 'container_start'
	| 'container_stop'
	| 'container_restart'
	| 'container_redeploy'
	| 'container_delete'
	| 'vulnerability_scan'
	| 'auto_update'
	| 'system_prune'
	| 'resource_action'
	| (string & {});

const activityTypeCases = [
	'image_pull',
	'image_build',
	'image_update_check',
	'project_pull',
	'project_build',
	'project_deploy',
	'project_redeploy',
	'project_down',
	'project_restart',
	'project_destroy',
	'container_start',
	'container_stop',
	'container_restart',
	'container_redeploy',
	'container_delete',
	'vulnerability_scan',
	'auto_update',
	'system_prune',
	'resource_action'
] as const;

export const ActivityType = {
	imagePull: 'image_pull',
	imageBuild: 'image_build',
	imageUpdateCheck: 'image_update_check',
	projectPull: 'project_pull',
	projectBuild: 'project_build',
	projectDeploy: 'project_deploy',
	projectRedeploy: 'project_redeploy',
	projectDown: 'project_down',
	projectRestart: 'project_restart',
	projectDestroy: 'project_destroy',
	containerStart: 'container_start',
	containerStop: 'container_stop',
	containerRestart: 'container_restart',
	containerRedeploy: 'container_redeploy',
	containerDelete: 'container_delete',
	vulnerabilityScan: 'vulnerability_scan',
	autoUpdate: 'auto_update',
	systemPrune: 'system_prune',
	resourceAction: 'resource_action',
	knownCases: activityTypeCases,
	isKnown(this: void, value: ActivityType): value is (typeof activityTypeCases)[number] {
		return (activityTypeCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): ActivityType {
		return raw;
	},
	rawValue(this: void, value: ActivityType): string {
		return value;
	},
	decode(this: void, raw: unknown): ActivityType {
		return D.str(raw);
	}
} as const;

// MARK: - ActivityMessageLevel

export type ActivityMessageLevel = 'info' | 'warning' | 'error' | 'success' | (string & {});

const activityMessageLevelCases = ['info', 'warning', 'error', 'success'] as const;

export const ActivityMessageLevel = {
	info: 'info',
	warning: 'warning',
	error: 'error',
	success: 'success',
	knownCases: activityMessageLevelCases,
	isKnown(
		this: void,
		value: ActivityMessageLevel
	): value is (typeof activityMessageLevelCases)[number] {
		return (activityMessageLevelCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): ActivityMessageLevel {
		return raw;
	},
	rawValue(this: void, value: ActivityMessageLevel): string {
		return value;
	},
	decode(this: void, raw: unknown): ActivityMessageLevel {
		return D.str(raw);
	}
} as const;

// MARK: - ActivityStreamEventType

export type ActivityStreamEventType =
	| 'snapshot'
	| 'activity'
	| 'message'
	| 'missed'
	| 'error'
	| 'heartbeat'
	| (string & {});

const activityStreamEventTypeCases = [
	'snapshot',
	'activity',
	'message',
	'missed',
	'error',
	'heartbeat'
] as const;

export const ActivityStreamEventType = {
	snapshot: 'snapshot',
	activity: 'activity',
	message: 'message',
	missed: 'missed',
	error: 'error',
	heartbeat: 'heartbeat',
	knownCases: activityStreamEventTypeCases,
	isKnown(
		this: void,
		value: ActivityStreamEventType
	): value is (typeof activityStreamEventTypeCases)[number] {
		return (activityStreamEventTypeCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): ActivityStreamEventType {
		return raw;
	},
	rawValue(this: void, value: ActivityStreamEventType): string {
		return value;
	},
	decode(this: void, raw: unknown): ActivityStreamEventType {
		return D.str(raw);
	}
} as const;

// MARK: - Models

export interface ActivityStartedBy {
	userId?: string;
	username: string;
	displayName?: string;
}

export interface Activity {
	id: string;
	/** JSON key `environmentId`. */
	environmentID: string;
	/** JSON key `batchId`. */
	batchID?: string;
	/** JSON key `sourceEnvironmentId`. */
	sourceEnvironmentID?: string;
	sourceEnvironmentName?: string;
	type: ActivityType;
	status: ActivityStatus;
	resourceType?: string;
	/** JSON key `resourceId`. */
	resourceID?: string;
	resourceName?: string;
	progress?: number;
	step: string;
	latestMessage: string;
	startedBy?: ActivityStartedBy;
	startedAt: ISODateString;
	endedAt?: ISODateString;
	durationMs?: number;
	error?: string;
	metadata?: Record<string, JSONValue>;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
}

export const Activity = {
	/** Swift memberwise init defaults (`step` / `latestMessage` default to `""`). */
	make(
		this: void,
		init: Omit<Activity, 'step' | 'latestMessage'> & { step?: string; latestMessage?: string }
	): Activity {
		return { ...init, step: init.step ?? '', latestMessage: init.latestMessage ?? '' };
	},

	/** Synthesized `Codable` with `CodingKeys` renames. */
	decode(this: void, raw: unknown): Activity {
		const o = D.object(raw, 'Activity');
		return {
			id: D.string(o, 'id'),
			environmentID: D.string(o, 'environmentId'),
			batchID: D.optString(o, 'batchId'),
			sourceEnvironmentID: D.optString(o, 'sourceEnvironmentId'),
			sourceEnvironmentName: D.optString(o, 'sourceEnvironmentName'),
			type: D.nested(o, 'type', ActivityType.decode),
			status: D.nested(o, 'status', ActivityStatus.decode),
			resourceType: D.optString(o, 'resourceType'),
			resourceID: D.optString(o, 'resourceId'),
			resourceName: D.optString(o, 'resourceName'),
			progress: D.optInt(o, 'progress'),
			step: D.string(o, 'step'),
			latestMessage: D.string(o, 'latestMessage'),
			startedBy: D.optNested(o, 'startedBy', D.cast<ActivityStartedBy>),
			startedAt: D.string(o, 'startedAt'),
			endedAt: D.optString(o, 'endedAt'),
			durationMs: D.optInt(o, 'durationMs'),
			error: D.optString(o, 'error'),
			metadata: D.optRecord(o, 'metadata', D.cast<JSONValue>),
			createdAt: D.string(o, 'createdAt'),
			updatedAt: D.optString(o, 'updatedAt')
		};
	},

	encode(this: void, value: Activity): Record<string, unknown> {
		const { environmentID, batchID, sourceEnvironmentID, resourceID, ...rest } = value;
		return {
			...rest,
			environmentId: environmentID,
			batchId: batchID,
			sourceEnvironmentId: sourceEnvironmentID,
			resourceId: resourceID
		};
	}
} as const;

export interface ActivityMessage {
	id: string;
	/** JSON key `activityId`. */
	activityID: string;
	level: ActivityMessageLevel;
	message: string;
	payload?: Record<string, JSONValue>;
	createdAt: ISODateString;
}

export const ActivityMessage = {
	decode(this: void, raw: unknown): ActivityMessage {
		const o = D.object(raw, 'ActivityMessage');
		return {
			id: D.string(o, 'id'),
			activityID: D.string(o, 'activityId'),
			level: D.nested(o, 'level', ActivityMessageLevel.decode),
			message: D.string(o, 'message'),
			payload: D.optRecord(o, 'payload', D.cast<JSONValue>),
			createdAt: D.string(o, 'createdAt')
		};
	},

	encode(this: void, value: ActivityMessage): Record<string, unknown> {
		const { activityID, ...rest } = value;
		return { ...rest, activityId: activityID };
	}
} as const;

export interface ActivityDetail {
	activity: Activity;
	messages: ActivityMessage[];
}

export const ActivityDetail = {
	make(this: void, init: { activity: Activity; messages?: ActivityMessage[] }): ActivityDetail {
		return { activity: init.activity, messages: init.messages ?? [] };
	},

	decode(this: void, raw: unknown): ActivityDetail {
		const o = D.object(raw, 'ActivityDetail');
		return {
			activity: D.nested(o, 'activity', Activity.decode),
			messages: D.array(o, 'messages', ActivityMessage.decode)
		};
	},

	encode(this: void, value: ActivityDetail): Record<string, unknown> {
		return {
			activity: Activity.encode(value.activity),
			messages: value.messages.map(ActivityMessage.encode)
		};
	}
} as const;

export interface ActivityStreamEvent {
	type: ActivityStreamEventType;
	/** JSON key `environmentId`. */
	environmentID?: string;
	/** JSON key `activityId`. */
	activityID?: string;
	activity?: Activity;
	activities: Activity[];
	message?: ActivityMessage;
	error?: string;
	timestamp: ISODateString;
}

export const ActivityStreamEvent = {
	make(
		this: void,
		init: Omit<ActivityStreamEvent, 'activities'> & { activities?: Activity[] }
	): ActivityStreamEvent {
		return { ...init, activities: init.activities ?? [] };
	},

	/**
	 * Swift `init(from:)`: unwraps the multiplexed `/stream` envelope
	 * (`{ channel: "activities", activity: {...} }`) before decoding.
	 */
	decode(this: void, raw: unknown): ActivityStreamEvent {
		const envelope = D.object(raw, 'ActivityStreamEvent');
		if (D.optString(envelope, 'channel') === 'activities') {
			return D.nested(envelope, 'activity', ActivityStreamEvent.decode);
		}
		const o = envelope;
		return {
			type: D.nested(o, 'type', ActivityStreamEventType.decode),
			environmentID: D.optString(o, 'environmentId'),
			activityID: D.optString(o, 'activityId'),
			activity: D.optNested(o, 'activity', Activity.decode),
			activities: D.optArray(o, 'activities', Activity.decode) ?? [],
			message: D.optNested(o, 'message', ActivityMessage.decode),
			error: D.optString(o, 'error'),
			timestamp: D.string(o, 'timestamp')
		};
	},

	encode(this: void, value: ActivityStreamEvent): Record<string, unknown> {
		return {
			type: value.type,
			environmentId: value.environmentID,
			activityId: value.activityID,
			activity: value.activity === undefined ? undefined : Activity.encode(value.activity),
			activities: value.activities.map(Activity.encode),
			message: value.message === undefined ? undefined : ActivityMessage.encode(value.message),
			error: value.error,
			timestamp: value.timestamp
		};
	}
} as const;

export interface ClearActivityHistoryResult {
	deleted: number;
}
