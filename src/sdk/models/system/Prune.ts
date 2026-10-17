/** Port of Models/System/Prune.swift. */
import { D } from '../base/decoding';

export type PruneContainerMode = 'none' | 'stopped' | 'olderThan';
export const PruneContainerMode = {
	none: 'none',
	stopped: 'stopped',
	olderThan: 'olderThan'
} as const satisfies Record<string, PruneContainerMode>;

export type PruneImageMode = 'none' | 'dangling' | 'all' | 'olderThan';
export const PruneImageMode = {
	none: 'none',
	dangling: 'dangling',
	all: 'all',
	olderThan: 'olderThan'
} as const satisfies Record<string, PruneImageMode>;

export type PruneVolumeMode = 'none' | 'anonymous' | 'all';
export const PruneVolumeMode = {
	none: 'none',
	anonymous: 'anonymous',
	all: 'all'
} as const satisfies Record<string, PruneVolumeMode>;

export type PruneNetworkMode = 'none' | 'unused' | 'olderThan';
export const PruneNetworkMode = {
	none: 'none',
	unused: 'unused',
	olderThan: 'olderThan'
} as const satisfies Record<string, PruneNetworkMode>;

export type PruneBuildCacheMode = 'none' | 'unused' | 'all' | 'olderThan';
export const PruneBuildCacheMode = {
	none: 'none',
	unused: 'unused',
	all: 'all',
	olderThan: 'olderThan'
} as const satisfies Record<string, PruneBuildCacheMode>;

export interface PruneContainersOptions {
	mode: PruneContainerMode;
	until?: string;
}

export interface PruneImagesOptions {
	mode: PruneImageMode;
	until?: string;
}

export interface PruneVolumesOptions {
	mode: PruneVolumeMode;
}

export interface PruneNetworksOptions {
	mode: PruneNetworkMode;
	until?: string;
}

export interface PruneBuildCacheOptions {
	mode: PruneBuildCacheMode;
	until?: string;
}

/** Body for `POST /environments/{id}/system/prune`. */
export interface PruneAllRequest {
	containers?: PruneContainersOptions;
	images?: PruneImagesOptions;
	volumes?: PruneVolumesOptions;
	networks?: PruneNetworksOptions;
	buildCache?: PruneBuildCacheOptions;
}

/** Result of a system prune. */
export interface PruneAllResult {
	containersPruned?: string[];
	imagesDeleted?: string[];
	volumesDeleted?: string[];
	networksDeleted?: string[];
	spaceReclaimed: number;
	containerSpaceReclaimed?: number;
	imageSpaceReclaimed?: number;
	volumeSpaceReclaimed?: number;
	buildCacheSpaceReclaimed?: number;
	success: boolean;
	errors?: string[];
	/** JSON key `activityId`. */
	activityID?: string;
}

export const PruneAllResult = {
	/** Swift memberwise init defaults (`spaceReclaimed: 0`, `success: false`). */
	make(this: void, args: Partial<PruneAllResult> = {}): PruneAllResult {
		return { ...args, spaceReclaimed: args.spaceReclaimed ?? 0, success: args.success ?? false };
	},

	decode(this: void, raw: unknown): PruneAllResult {
		const o = D.object(raw, 'PruneAllResult');
		return {
			containersPruned: D.optArray(o, 'containersPruned', D.str),
			imagesDeleted: D.optArray(o, 'imagesDeleted', D.str),
			volumesDeleted: D.optArray(o, 'volumesDeleted', D.str),
			networksDeleted: D.optArray(o, 'networksDeleted', D.str),
			spaceReclaimed: D.number(o, 'spaceReclaimed'),
			containerSpaceReclaimed: D.optNumber(o, 'containerSpaceReclaimed'),
			imageSpaceReclaimed: D.optNumber(o, 'imageSpaceReclaimed'),
			volumeSpaceReclaimed: D.optNumber(o, 'volumeSpaceReclaimed'),
			buildCacheSpaceReclaimed: D.optNumber(o, 'buildCacheSpaceReclaimed'),
			success: D.boolean(o, 'success'),
			errors: D.optArray(o, 'errors', D.str),
			activityID: D.optString(o, 'activityId')
		};
	},

	encode(this: void, value: PruneAllResult): Record<string, unknown> {
		const { activityID, ...rest } = value;
		return { ...rest, activityId: activityID };
	}
} as const;
