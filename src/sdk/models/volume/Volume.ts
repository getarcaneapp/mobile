import type { PaginationResponse } from '../base/pagination';
import { D } from '../base/decoding';

export interface VolumeUsageData {
	size: number;
	refCount: number;
}

export const VolumeUsageData = {
	make(this: void, init: Partial<VolumeUsageData> = {}): VolumeUsageData {
		return { size: init.size ?? 0, refCount: init.refCount ?? 0 };
	},
	decode(this: void, raw: unknown): VolumeUsageData {
		const o = D.object(raw, 'VolumeUsageData');
		return { size: D.number(o, 'Size'), refCount: D.number(o, 'RefCount') };
	},
	encode(this: void, value: VolumeUsageData): Record<string, unknown> {
		return { Size: value.size, RefCount: value.refCount };
	}
} as const;

export interface Volume {
	id: string;
	name: string;
	driver: string;
	mountpoint: string;
	scope: string;
	options: Record<string, string>;
	labels: Record<string, string>;
	createdAt: string;
	inUse: boolean;
	usageData?: VolumeUsageData;
	size: number;
	containers: string[];
	activityID?: string;
}

export const Volume = {
	make(
		this: void,
		init: Pick<Volume, 'id' | 'name' | 'driver' | 'mountpoint' | 'scope' | 'createdAt'> &
			Partial<Volume>
	): Volume {
		return {
			...init,
			options: init.options ?? {},
			labels: init.labels ?? {},
			inUse: init.inUse ?? false,
			size: init.size ?? 0,
			containers: init.containers ?? []
		};
	},
	decode(this: void, raw: unknown): Volume {
		const o = D.object(raw, 'Volume');
		return {
			id: D.string(o, 'id'),
			name: D.optString(o, 'name') ?? '',
			driver: D.optString(o, 'driver') ?? '',
			mountpoint: D.optString(o, 'mountpoint') ?? '',
			scope: D.optString(o, 'scope') ?? '',
			options: D.optRecord(o, 'options', D.str) ?? {},
			labels: D.optRecord(o, 'labels', D.str) ?? {},
			createdAt: D.optString(o, 'createdAt') ?? '',
			inUse: D.optBoolean(o, 'inUse') ?? false,
			usageData: D.optNested(o, 'usageData', VolumeUsageData.decode),
			size: D.optNumber(o, 'size') ?? 0,
			containers: D.optArray(o, 'containers', D.str) ?? [],
			activityID: D.optString(o, 'activityId')
		};
	},
	encode(this: void, value: Volume): Record<string, unknown> {
		const { activityID, usageData, ...rest } = value;
		return {
			...rest,
			usageData: usageData === undefined ? undefined : VolumeUsageData.encode(usageData),
			activityId: activityID
		};
	}
} as const;

export interface VolumeUsageCounts {
	inuse: number;
	unused: number;
	total: number;
}

export interface VolumePruneReport {
	volumesDeleted: string[];
	spaceReclaimed: number;
	activityID?: string;
}

export const VolumePruneReport = {
	decode(this: void, raw: unknown): VolumePruneReport {
		const o = D.object(raw, 'VolumePruneReport');
		return {
			volumesDeleted: D.array(o, 'volumesDeleted', D.str),
			spaceReclaimed: D.number(o, 'spaceReclaimed'),
			activityID: D.optString(o, 'activityId')
		};
	},
	encode(this: void, value: VolumePruneReport): Record<string, unknown> {
		return {
			volumesDeleted: value.volumesDeleted,
			spaceReclaimed: value.spaceReclaimed,
			activityId: value.activityID
		};
	}
} as const;

export interface CreateVolume {
	name: string;
	driver?: string;
	driverOpts?: Record<string, string>;
	labels?: Record<string, string>;
}

export interface VolumeUsage {
	inUse: boolean;
	containers: string[];
}

export interface VolumeSizeInfo {
	name: string;
	size: number;
	refCount: number;
}

export interface VolumeListPage {
	success: boolean;
	data: Volume[];
	counts: VolumeUsageCounts;
	pagination: PaginationResponse;
}

export const VolumeListPage = {
	decode(raw: unknown): VolumeListPage {
		const o = D.object(raw, 'VolumeListPage');
		return {
			success: D.boolean(o, 'success'),
			data: D.array(o, 'data', Volume.decode),
			counts: D.nested(o, 'counts', D.cast<VolumeUsageCounts>),
			pagination: D.nested(o, 'pagination', D.cast<PaginationResponse>)
		};
	}
} as const;
