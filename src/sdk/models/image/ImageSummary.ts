import type { JSONValue } from '../../types/json';
import { D } from '../base/decoding';
import type { PaginationResponse } from '../base/pagination';
import type { VulnerabilityScanSummary } from '../vulnerability/VulnerabilityScan';
import type { ImageUpdateInfo } from './ImageUpdateInfo';

export interface ImageUsedBy {
	type: string;
	name: string;
	id?: string;
}

export interface ImageSummary {
	id: string;
	repoTags: string[];
	repoDigests: string[];
	created: number;
	size: number;
	virtualSize: number;
	labels: Record<string, JSONValue>;
	inUse: boolean;
	usedBy?: ImageUsedBy[];
	repo: string;
	tag: string;
	updateInfo?: ImageUpdateInfo;
	vulnerabilityScan?: VulnerabilityScanSummary;
}

export const ImageSummary = {
	make(this: void, init: Partial<ImageSummary> & Pick<ImageSummary, 'id'>): ImageSummary {
		return {
			...init,
			repoTags: init.repoTags ?? [],
			repoDigests: init.repoDigests ?? [],
			created: init.created ?? 0,
			size: init.size ?? 0,
			virtualSize: init.virtualSize ?? 0,
			labels: init.labels ?? {},
			inUse: init.inUse ?? false,
			repo: init.repo ?? '',
			tag: init.tag ?? ''
		};
	},

	decode(this: void, raw: unknown): ImageSummary {
		const o = D.object(raw, 'ImageSummary');
		return {
			id: D.string(o, 'id'),
			repoTags: D.array(o, 'repoTags', D.str),
			repoDigests: D.array(o, 'repoDigests', D.str),
			created: D.int(o, 'created'),
			size: D.int(o, 'size'),
			virtualSize: D.int(o, 'virtualSize'),
			labels: D.optRecord(o, 'labels', D.cast<JSONValue>) ?? {},
			inUse: D.boolean(o, 'inUse'),
			usedBy: D.optArray(o, 'usedBy', D.cast<ImageUsedBy>),
			repo: D.string(o, 'repo'),
			tag: D.string(o, 'tag'),
			updateInfo: D.optNested(o, 'updateInfo', D.cast<ImageUpdateInfo>),
			vulnerabilityScan: D.optNested(o, 'vulnerabilityScan', D.cast<VulnerabilityScanSummary>)
		};
	}
} as const;

export interface ImagePruneReport {
	imagesDeleted: string[];
	spaceReclaimed: number;
}

export const ImagePruneReport = {
	make(init: Partial<ImagePruneReport> = {}): ImagePruneReport {
		return { imagesDeleted: init.imagesDeleted ?? [], spaceReclaimed: init.spaceReclaimed ?? 0 };
	}
} as const;

export interface ImageUsageCounts {
	imagesInuse: number;
	imagesUnused: number;
	totalImages: number;
	totalImageSize: number;
}

export const ImageUsageCounts = {
	make(init: Partial<ImageUsageCounts> = {}): ImageUsageCounts {
		return {
			imagesInuse: init.imagesInuse ?? 0,
			imagesUnused: init.imagesUnused ?? 0,
			totalImages: init.totalImages ?? 0,
			totalImageSize: init.totalImageSize ?? 0
		};
	}
} as const;

export interface ImageLoadResult {
	stream: string;
}

export const ImageLoadResult = {
	make(init: Partial<ImageLoadResult> = {}): ImageLoadResult {
		return { stream: init.stream ?? '' };
	}
} as const;

export interface ImageListResponse {
	success: boolean;
	data: ImageSummary[];
	pagination: PaginationResponse;
}

export const ImageListResponse = {
	decode(raw: unknown): ImageListResponse {
		const o = D.object(raw, 'ImageListResponse');
		return {
			success: D.boolean(o, 'success'),
			data: D.array(o, 'data', ImageSummary.decode),
			pagination: D.nested(o, 'pagination', D.cast<PaginationResponse>)
		};
	}
} as const;
