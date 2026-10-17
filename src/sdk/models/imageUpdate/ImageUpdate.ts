/** Port of Models/ImageUpdate/ImageUpdate.swift. */
import type { ISODateString } from '../base/date';
import { D, mapRecord } from '../base/decoding';
import type { ContainerRegistryCredential } from '../containerRegistry/ContainerRegistry';

/** Result of an image update check. */
export interface ImageUpdateResponse {
	hasUpdate: boolean;
	updateType: string;
	currentVersion: string;
	latestVersion?: string;
	currentDigest?: string;
	latestDigest?: string;
	/** Optional so responses from servers that omit the timestamp still decode. */
	checkTime?: ISODateString;
	responseTimeMs: number;
	error?: string;
	authMethod?: string;
	authUsername?: string;
	authRegistry?: string;
	usedCredential?: boolean;
	/** Background activity that tracked this check (v2 servers). JSON key `activityId`. */
	activityID?: string;
}

export const ImageUpdateResponse = {
	make(this: void, init: Partial<ImageUpdateResponse> = {}): ImageUpdateResponse {
		return {
			...init,
			hasUpdate: init.hasUpdate ?? false,
			updateType: init.updateType ?? '',
			currentVersion: init.currentVersion ?? '',
			responseTimeMs: init.responseTimeMs ?? 0
		};
	},

	decode(this: void, raw: unknown): ImageUpdateResponse {
		const o = D.object(raw, 'ImageUpdateResponse');
		return {
			hasUpdate: D.boolean(o, 'hasUpdate'),
			updateType: D.string(o, 'updateType'),
			currentVersion: D.string(o, 'currentVersion'),
			latestVersion: D.optString(o, 'latestVersion'),
			currentDigest: D.optString(o, 'currentDigest'),
			latestDigest: D.optString(o, 'latestDigest'),
			checkTime: D.optString(o, 'checkTime'),
			responseTimeMs: D.int(o, 'responseTimeMs'),
			error: D.optString(o, 'error'),
			authMethod: D.optString(o, 'authMethod'),
			authUsername: D.optString(o, 'authUsername'),
			authRegistry: D.optString(o, 'authRegistry'),
			usedCredential: D.optBoolean(o, 'usedCredential'),
			activityID: D.optString(o, 'activityId')
		};
	},

	encode(this: void, value: ImageUpdateResponse): Record<string, unknown> {
		const { activityID, ...rest } = value;
		return { ...rest, activityId: activityID };
	}
} as const;

/** Aggregate summary of image update status across an environment. */
export interface ImageUpdateSummary {
	totalImages: number;
	imagesWithUpdates: number;
	digestUpdates: number;
	errorsCount: number;
}

export const ImageUpdateSummary = {
	make(init: Partial<ImageUpdateSummary> = {}): ImageUpdateSummary {
		return {
			totalImages: init.totalImages ?? 0,
			imagesWithUpdates: init.imagesWithUpdates ?? 0,
			digestUpdates: init.digestUpdates ?? 0,
			errorsCount: init.errorsCount ?? 0
		};
	}
} as const;

/** Request body for the batch image update check endpoint. */
export interface BatchImageUpdateRequest {
	imageRefs: string[];
	credentials?: ContainerRegistryCredential[];
}

/** Request body for the "check all images" endpoint. */
export interface CheckAllImagesRequest {
	credentials?: ContainerRegistryCredential[];
}

/**
 * Map keyed by image reference. Values may be undefined if the check failed.
 * Note: the transport strips `null` object properties, so references whose
 * check failed (`null` on the wire) are absent from the map rather than
 * present with an `undefined` value.
 */
export type ImageUpdateBatchResponse = Record<string, ImageUpdateResponse | undefined>;

export const ImageUpdateBatchResponse = {
	decode(this: void, raw: unknown): ImageUpdateBatchResponse {
		return mapRecord(D.object(raw, 'ImageUpdateBatchResponse'), (value) =>
			value === null ? undefined : ImageUpdateResponse.decode(value)
		);
	}
} as const;
