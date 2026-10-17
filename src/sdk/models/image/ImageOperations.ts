/** Port of Models/Image/ImageOperations.swift. */
import type { ISODateString } from '../base/date';

export interface ImageSearchResult {
	name: string;
	description: string;
	starCount: number;
	official: boolean;
	automated: boolean;
}

export const ImageSearchResult = {
	/** Swift `Identifiable.id`. */
	id(value: ImageSearchResult): string {
		return value.name;
	}
} as const;

export interface ImageTagRequest {
	repository: string;
	tag?: string;
}

export interface ImagePatchOptions {
	suffix?: string;
	patchedTag?: string;
	timeoutSeconds?: number;
	scanId?: string;
	ignoreErrors?: boolean;
}

export interface ImagePatchRecord {
	id: string;
	environmentId: string;
	originalImageId: string;
	originalRef: string;
	originalDigest?: string;
	patchedRef: string;
	mode: string;
	status: string;
	packagesUpdated?: number;
	error?: string;
	activityId?: string;
	durationMs?: number;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
}

export interface ImagePatchScanSummary {
	status: string;
	fixableCount: number;
	totalCount: number;
	scanTime: ISODateString;
}

export interface ImagePatchTarget {
	imageId: string;
	imageRef: string;
	fixableCount: number;
	totalCount: number;
	scanTime: ISODateString;
	localOnly?: boolean;
	lastPatch?: ImagePatchRecord;
	lastPatchScan?: ImagePatchScanSummary;
}

export const ImagePatchTarget = {
	/** Swift `Identifiable.id`. */
	id(value: ImagePatchTarget): string {
		return value.imageId;
	}
} as const;
