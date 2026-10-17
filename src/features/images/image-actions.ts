/**
 * Shared image side effects: cache invalidation + mutation bump
 * (`invalidateImageCaches(_:)` + `mutationStore.markChanged(kind: .images, …)`),
 * the activity-batch scoped client, and the image pull started from
 * `PullImageView` (`DeploymentActivityStore.start(kind: .imagePull, …)`).
 */
import { randomUUID } from 'expo-crypto';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { ArcaneRequestOptions } from '@/sdk/http/requestOptions';
import { useClientManager } from '@/stores/client-manager';
import { useImageUpdateCountStore } from '@/stores/image-update-count-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { finishActivityToast, showActivityToast, showToast, Toasts } from '@/ui/toast';

import { parseImageNameAndTag } from './image-model';

/** `invalidateImageCaches(_:)`. */
export function invalidateImageCaches(environmentID: EnvironmentID) {
	const client = useClientManager.getState().client;
	const cached = cachedClient();
	if (!client || !cached) return;
	cached.invalidate(environmentID, [
		client.rest.environmentPath(environmentID, 'images') + '*',
		client.rest.environmentPath(environmentID, 'images/*')
	]);
}

/** Invalidate + bump the images mutation version so every list/detail reloads. */
export function imagesChanged(environmentID: EnvironmentID) {
	invalidateImageCaches(environmentID);
	useResourceMutationStore.getState().markChanged('images', environmentID);
}

/** `ActivityBatchID.scopedClient(_:)`. */
export function activityBatchScopedClient(client: ArcaneClient): ArcaneClient {
	return client.withRequestOptions(
		ArcaneRequestOptions.withActivityBatchID(randomUUID().toLowerCase())
	);
}

let pullCounter = 0;
let pullRunning = false;

/**
 * The `.imagePull` slice of `DeploymentActivityStore`: streams the pull and
 * reports progress and the outcome as an activity toast (the Swift app's
 * floating pill + Live Activity), then refreshes images on success.
 */
export function startImagePull(
	environmentID: EnvironmentID,
	reference: string,
	_environmentName: string
): boolean {
	if (pullRunning) {
		showToast(Toasts.info('Another deployment is running'));
		return false;
	}
	const client = useClientManager.getState().client;
	if (!client) return false;
	const session = useClientManager.getState().clientGeneration;
	const id = `image-pull-${++pullCounter}`;
	const title = `Pull ${reference}`;
	pullRunning = true;
	showActivityToast(id, title);

	void (async () => {
		let failure: string | undefined;
		try {
			const { name, tag } = parseImageNameAndTag(reference);
			for await (const event of client.images.pullStream({
				envID: environmentID,
				options: { imageName: name, tag }
			})) {
				if (event.error) failure = event.error;
				const detail = event.progressDetail;
				if (detail?.current !== undefined && detail.total !== undefined && detail.total > 0) {
					showActivityToast(id, title, Math.min(Math.max(detail.current / detail.total, 0), 1));
				}
			}
		} catch (error) {
			failure = isCancellation(error) ? 'Cancelled' : friendlyErrorMessage(error);
		}
		pullRunning = false;
		// Session teardown while running: don't land completion effects on the new session.
		if (useClientManager.getState().clientGeneration !== session) return;
		if (failure === undefined) {
			invalidateImageCaches(environmentID);
			await useImageUpdateCountStore
				.getState()
				.refreshCount(environmentID, client, useClientManager.getState().currentUser?.id);
			useResourceMutationStore.getState().markChanged('images', environmentID);
			finishActivityToast(id, title, 'success');
		} else {
			finishActivityToast(id, title, 'failure');
			showToast(Toasts.error(failure));
		}
	})();
	return true;
}
