/** Port of Models/Container/ContainerSummary.swift. */
import { parseArcaneDate, type ISODateString } from '../base/date';
import { D, DecodingError, type RawObject } from '../base/decoding';
import type { ImageUpdateInfo } from '../image/ImageUpdateInfo';
import {
	ContainerNetworkSettings,
	type ContainerHostConfig,
	type ContainerMount,
	type ContainerPort
} from './Container';

/** A container summary as returned by the list endpoint. */
export interface ContainerSummary {
	id: string;
	names: string[];
	image: string;
	imageId: string;
	command: string;
	created: number;
	ports: ContainerPort[];
	labels: Record<string, string>;
	state: string;
	status: string;
	hostConfig: ContainerHostConfig;
	networkSettings: ContainerNetworkSettings;
	mounts: ContainerMount[];
	iconLightUrl?: string;
	iconDarkUrl?: string;
	updateInfo?: ImageUpdateInfo;
	redeployDisabled?: boolean;
	hidden?: boolean;
	/**
	 * Resource usage sampled by the server's shared stats collector. Only present on
	 * resource-sorted list requests (`ContainerResourceSort`) for running containers.
	 */
	resourceSample?: ContainerResourceSample;
}

export const ContainerSummary = {
	make(
		this: void,
		init: Partial<ContainerSummary> &
			Pick<ContainerSummary, 'id' | 'image' | 'imageId' | 'state' | 'status'>
	): ContainerSummary {
		return {
			...init,
			names: init.names ?? [],
			command: init.command ?? '',
			created: init.created ?? 0,
			ports: init.ports ?? [],
			labels: init.labels ?? {},
			hostConfig: init.hostConfig ?? {},
			networkSettings: init.networkSettings ?? ContainerNetworkSettings.make(),
			mounts: init.mounts ?? []
		};
	},

	/** Swift `init(from:)`. */
	decode(this: void, raw: unknown): ContainerSummary {
		const o = D.object(raw, 'ContainerSummary');
		return {
			id: D.string(o, 'id'),
			names: D.array(o, 'names', D.str),
			image: D.string(o, 'image'),
			imageId: D.string(o, 'imageId'),
			command: D.string(o, 'command'),
			created: D.int(o, 'created'),
			ports: D.array(o, 'ports', D.cast<ContainerPort>),
			labels: D.optRecord(o, 'labels', D.str) ?? {},
			state: D.string(o, 'state'),
			status: D.string(o, 'status'),
			hostConfig: D.nested(o, 'hostConfig', D.cast<ContainerHostConfig>),
			networkSettings: D.nested(o, 'networkSettings', ContainerNetworkSettings.decode),
			mounts: D.array(o, 'mounts', D.cast<ContainerMount>),
			iconLightUrl: D.optString(o, 'iconLightUrl'),
			iconDarkUrl: D.optString(o, 'iconDarkUrl'),
			updateInfo: D.optNested(o, 'updateInfo', D.cast<ImageUpdateInfo>),
			redeployDisabled: D.optBoolean(o, 'redeployDisabled'),
			hidden: D.optBoolean(o, 'hidden'),
			// A malformed sample must not drop the whole row from the lossy list decode.
			resourceSample: D.attempt(() =>
				D.optNested(o, 'resourceSample', ContainerResourceSample.decode)
			)
		};
	}
} as const;

/**
 * Server-side container list sort keys backed by the shared stats collector.
 * Responses sorted by these keys carry `ContainerSummary.resourceSample` for
 * running containers; check `ContainerListResponse.resourceSortSupported`
 * because older servers ignore the key and fall back to their default order.
 */
export type ContainerResourceSort = 'cpuUsage' | 'memoryUsage';

export const ContainerResourceSort = {
	cpuUsage: 'cpuUsage',
	memoryUsage: 'memoryUsage',
	/** Swift `CaseIterable.allCases`. */
	allCases: ['cpuUsage', 'memoryUsage'] as const
} as const;

/**
 * A point-in-time resource usage sample for a container. Ordering and the
 * displayed values come from the same sample.
 */
export interface ContainerResourceSample {
	/** Normalized CPU usage percentage (0-100 scale). */
	cpuPercent: number;
	memoryUsageBytes: number;
	/** Memory limit in bytes; the host total when the container has no limit. */
	memoryLimitBytes: number;
	sampleTime?: ISODateString;
}

function optValidDate(o: RawObject, key: string): ISODateString | undefined {
	const value = D.optString(o, key);
	if (value !== undefined && parseArcaneDate(value) === undefined) {
		throw new DecodingError('Invalid ISO8601 date', key);
	}
	return value;
}

export const ContainerResourceSample = {
	make(this: void, init: Partial<ContainerResourceSample> = {}): ContainerResourceSample {
		return {
			cpuPercent: init.cpuPercent ?? 0,
			memoryUsageBytes: init.memoryUsageBytes ?? 0,
			memoryLimitBytes: init.memoryLimitBytes ?? 0,
			sampleTime: init.sampleTime
		};
	},

	/** Memory usage as a percentage of the limit, or undefined when the limit is unknown. */
	memoryPercent(this: void, value: ContainerResourceSample): number | undefined {
		if (!(value.memoryLimitBytes > 0)) return undefined;
		return Math.min(Math.max((value.memoryUsageBytes / value.memoryLimitBytes) * 100, 0), 100);
	},

	/** Swift `init(from:)`: an unparseable `sampleTime` decodes as undefined. */
	decode(this: void, raw: unknown): ContainerResourceSample {
		const o = D.object(raw, 'ContainerResourceSample');
		return {
			cpuPercent: D.number(o, 'cpuPercent'),
			memoryUsageBytes: D.int(o, 'memoryUsageBytes'),
			memoryLimitBytes: D.int(o, 'memoryLimitBytes'),
			sampleTime: D.attempt(() => optValidDate(o, 'sampleTime'))
		};
	}
} as const;

/** A group of container summaries, e.g. by Compose project. */
export interface ContainerSummaryGroup {
	groupName: string;
	items: ContainerSummary[];
}

export const ContainerSummaryGroup = {
	make(
		this: void,
		init: Partial<ContainerSummaryGroup> & Pick<ContainerSummaryGroup, 'groupName'>
	): ContainerSummaryGroup {
		return { groupName: init.groupName, items: init.items ?? [] };
	},

	/** Swift `init(from:)`: undecodable items are dropped. */
	decode(this: void, raw: unknown): ContainerSummaryGroup {
		const o = D.object(raw, 'ContainerSummaryGroup');
		return {
			groupName: D.string(o, 'groupName'),
			items: D.nested(o, 'items', decodeLossyContainerSummaryArray)
		};
	}
} as const;

/**
 * @internal Swift `LossyContainerSummaryArray`: decodes an array of
 * `ContainerSummary`, skipping elements that fail to decode.
 */
export function decodeLossyContainerSummaryArray(raw: unknown): ContainerSummary[] {
	if (!Array.isArray(raw)) throw new DecodingError('Expected array for LossyContainerSummaryArray');
	const elements: ContainerSummary[] = [];
	for (const item of raw) {
		const element = D.attempt(() => ContainerSummary.decode(item));
		if (element !== undefined) elements.push(element);
	}
	return elements;
}

/** Counts of containers by status. */
export interface ContainerStatusCounts {
	runningContainers: number;
	stoppedContainers: number;
	totalContainers: number;
}

export const ContainerStatusCounts = {
	make(init: Partial<ContainerStatusCounts> = {}): ContainerStatusCounts {
		return {
			runningContainers: init.runningContainers ?? 0,
			stoppedContainers: init.stoppedContainers ?? 0,
			totalContainers: init.totalContainers ?? 0
		};
	}
} as const;

/** Result of a container batch action (start/stop/etc). */
export interface ContainerActionResult {
	started?: string[];
	stopped?: string[];
	failed?: string[];
	success: boolean;
	errors?: string[];
	/** JSON key `activityId`. */
	activityID?: string;
}

export const ContainerActionResult = {
	make(init: Partial<ContainerActionResult> = {}): ContainerActionResult {
		return { ...init, success: init.success ?? false };
	},

	decode(raw: unknown): ContainerActionResult {
		const o = D.object(raw, 'ContainerActionResult');
		return {
			started: D.optArray(o, 'started', D.str),
			stopped: D.optArray(o, 'stopped', D.str),
			failed: D.optArray(o, 'failed', D.str),
			success: D.boolean(o, 'success'),
			errors: D.optArray(o, 'errors', D.str),
			activityID: D.optString(o, 'activityId')
		};
	},

	encode(value: ContainerActionResult): Record<string, unknown> {
		return {
			started: value.started,
			stopped: value.stopped,
			failed: value.failed,
			success: value.success,
			errors: value.errors,
			activityId: value.activityID
		};
	}
} as const;

/** A newly created container. */
export interface ContainerCreated {
	id: string;
	name: string;
	image: string;
	status: string;
	created: string;
}
