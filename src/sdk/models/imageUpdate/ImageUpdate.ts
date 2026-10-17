import type { ISODateString } from '../base/date';
import { D, mapRecord } from '../base/decoding';
import type { ContainerRegistryCredential } from '../containerRegistry/ContainerRegistry';

export interface ImageUpdateResponse {
	hasUpdate: boolean;
	updateType: string;
	currentVersion: string;
	latestVersion?: string;
	currentDigest?: string;
	latestDigest?: string;
	checkTime?: ISODateString;
	responseTimeMs: number;
	error?: string;
	authMethod?: string;
	authUsername?: string;
	authRegistry?: string;
	usedCredential?: boolean;
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

export interface BatchImageUpdateRequest {
	imageRefs: string[];
	credentials?: ContainerRegistryCredential[];
}

export interface CheckAllImagesRequest {
	credentials?: ContainerRegistryCredential[];
}

export type ImageUpdateBatchResponse = Record<string, ImageUpdateResponse | undefined>;

export const ImageUpdateBatchResponse = {
	decode(this: void, raw: unknown): ImageUpdateBatchResponse {
		return mapRecord(D.object(raw, 'ImageUpdateBatchResponse'), (value) =>
			value === null ? undefined : ImageUpdateResponse.decode(value)
		);
	}
} as const;
