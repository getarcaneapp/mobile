import { PaginationLoader } from '@/core/networking/pagination-loader';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ImageSummary } from '@/sdk/models/image/ImageSummary';
import { ImageUpdateInfo } from '@/sdk/models/image/ImageUpdateInfo';
import type { ImageUpdateResponse, ImageUpdateSummary } from '@/sdk/models/imageUpdate/ImageUpdate';

import { outdatedImages } from './updates-logic';

export type EnvironmentUpdates = {
	summary?: ImageUpdateSummary;
	images: ImageSummary[];
	byRef: Record<string, ImageUpdateResponse>;
	totalImages: number;
	listFailed: boolean;
	error?: string;
};

export async function fetchEnvironmentUpdates(
	envID: EnvironmentID,
	client: ArcaneClient
): Promise<EnvironmentUpdates> {
	const pendingSummary = client.images.updateSummary({ envID }).catch(() => undefined);

	let images: ImageSummary[];
	let listError: string | undefined;
	try {
		images = await PaginationLoader.collect(async (start, limit) => {
			const response = await client.images.list({ envID, query: { start, limit } });
			return { items: response.data, pagination: response.pagination };
		});
	} catch (error) {
		images = [];
		listError = error instanceof Error ? error.message : String(error);
	}

	const refs = [
		...new Set(images.flatMap((image) => image.repoTags).filter((tag) => tag !== '<none>:<none>'))
	];

	const byRef: Record<string, ImageUpdateResponse> = {};
	for (const image of images) {
		const info = image.updateInfo;
		if (!info || !ImageUpdateInfo.hasCheckResult(info)) continue;
		const response = ImageUpdateInfo.asUpdateResponse(info);
		for (const tag of image.repoTags) if (tag !== '<none>:<none>') byRef[tag] = response;
	}

	const batches: string[][] = [];
	for (let offset = 0; offset < refs.length; offset += 100)
		batches.push(refs.slice(offset, offset + 100));
	const maps = await Promise.all(
		batches.map((batch) =>
			client.images
				.updateInfoByRefs({ envID, imageRefs: batch })
				.catch(() => ({}) as Record<string, ImageUpdateInfo | undefined>)
		)
	);
	for (const map of maps) {
		for (const [ref, info] of Object.entries(map)) {
			if (!info) continue;
			byRef[ref] = ImageUpdateInfo.asUpdateResponse(info);
		}
	}

	const summary = await pendingSummary;
	const error = summary === undefined && listError !== undefined ? listError : undefined;
	return {
		summary,
		images,
		byRef,
		totalImages: images.length,
		listFailed: listError !== undefined,
		error
	};
}

export async function environmentUpdateCount(
	envID: EnvironmentID,
	client: ArcaneClient
): Promise<number | undefined> {
	const updates = await fetchEnvironmentUpdates(envID, client);
	if (updates.listFailed) return updates.summary?.imagesWithUpdates;
	return outdatedImages(updates).length;
}
