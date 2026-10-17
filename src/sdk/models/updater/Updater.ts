/** Port of Models/Updater/Updater.swift. */
import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';
import { D } from '../base/decoding';

/** Options passed when triggering the updater (`POST .../updater/run`). */
export interface UpdaterOptions {
	type?: string;
	resourceIds?: string[];
	forceUpdate?: boolean;
	dryRun?: boolean;
}

/** Result for a single resource updated by the updater. */
export interface UpdaterResourceResult {
	resourceId: string;
	resourceName?: string;
	resourceType: string;
	status: string;
	updateAvailable?: boolean;
	updateApplied?: boolean;
	oldImages?: Record<string, string>;
	newImages?: Record<string, string>;
	error?: string;
	details?: Record<string, JSONValue>;
}

/** Overall result of an updater run. */
export interface UpdaterResult {
	success?: boolean;
	checked: number;
	updated: number;
	skipped: number;
	failed: number;
	startTime?: string;
	endTime?: string;
	duration: string;
	items: UpdaterResourceResult[];
	/** JSON key `activityId`. */
	activityID?: string;
}

export const UpdaterResult = {
	/** Swift memberwise init defaults (zero counts, empty `duration` and `items`). */
	make(this: void, args: Partial<UpdaterResult> = {}): UpdaterResult {
		return {
			...args,
			checked: args.checked ?? 0,
			updated: args.updated ?? 0,
			skipped: args.skipped ?? 0,
			failed: args.failed ?? 0,
			duration: args.duration ?? '',
			items: args.items ?? []
		};
	},

	decode(this: void, raw: unknown): UpdaterResult {
		const o = D.object(raw, 'UpdaterResult');
		return {
			success: D.optBoolean(o, 'success'),
			checked: D.int(o, 'checked'),
			updated: D.int(o, 'updated'),
			skipped: D.int(o, 'skipped'),
			failed: D.int(o, 'failed'),
			startTime: D.optString(o, 'startTime'),
			endTime: D.optString(o, 'endTime'),
			duration: D.string(o, 'duration'),
			items: D.array(o, 'items', D.cast<UpdaterResourceResult>),
			activityID: D.optString(o, 'activityId')
		};
	},

	encode(this: void, value: UpdaterResult): Record<string, unknown> {
		const { activityID, ...rest } = value;
		return { ...rest, activityId: activityID };
	}
} as const;

/** Live status of the updater. */
export interface UpdaterStatus {
	updatingContainers: number;
	updatingProjects: number;
	containerIds: string[];
	projectIds: string[];
}

export const UpdaterStatus = {
	/** Swift memberwise init defaults (zero counts, empty ID lists). */
	make(args: Partial<UpdaterStatus> = {}): UpdaterStatus {
		return {
			updatingContainers: args.updatingContainers ?? 0,
			updatingProjects: args.updatingProjects ?? 0,
			containerIds: args.containerIds ?? [],
			projectIds: args.projectIds ?? []
		};
	}
} as const;

export type AutoUpdateRecordStatus =
	| 'pending'
	| 'checking'
	| 'updating'
	| 'completed'
	| 'failed'
	| 'skipped';

export const AutoUpdateRecordStatus = {
	pending: 'pending',
	checking: 'checking',
	updating: 'updating',
	completed: 'completed',
	failed: 'failed',
	skipped: 'skipped'
} as const satisfies Record<string, AutoUpdateRecordStatus>;

/** One row in the updater run history. */
export interface AutoUpdateRecord {
	id: string;
	resourceId: string;
	resourceType: string;
	resourceName: string;
	status: AutoUpdateRecordStatus;
	startTime: ISODateString;
	endTime?: ISODateString;
	updateAvailable: boolean;
	updateApplied: boolean;
	oldImageVersions?: Record<string, JSONValue>;
	newImageVersions?: Record<string, JSONValue>;
	error?: string;
	details?: Record<string, JSONValue>;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
}
