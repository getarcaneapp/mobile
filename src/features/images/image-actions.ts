import { randomUUID } from 'expo-crypto';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { LiveActivities } from '@/core/live-activities';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { ArcaneRequestOptions } from '@/sdk/http/requestOptions';
import { useClientManager } from '@/stores/client-manager';
import { useImageUpdateCountStore } from '@/stores/image-update-count-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { finishActivityToast, showActivityToast, showToast, Toasts } from '@/ui/toast';

import { parseImageNameAndTag } from './image-model';

export function invalidateImageCaches(environmentID: EnvironmentID) {
	const client = useClientManager.getState().client;
	const cached = cachedClient();
	if (!client || !cached) return;
	cached.invalidate(environmentID, [
		client.rest.environmentPath(environmentID, 'images') + '*',
		client.rest.environmentPath(environmentID, 'images/*')
	]);
}

export function imagesChanged(environmentID: EnvironmentID) {
	invalidateImageCaches(environmentID);
	useResourceMutationStore.getState().markChanged('images', environmentID);
}

export function activityBatchScopedClient(client: ArcaneClient): ArcaneClient {
	return client.withRequestOptions(
		ArcaneRequestOptions.withActivityBatchID(randomUUID().toLowerCase())
	);
}

let pullCounter = 0;
let pullRunning = false;

export function startImagePull(
	environmentID: EnvironmentID,
	reference: string,
	environmentName: string
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
	LiveActivities.start(
		id,
		{ title, symbolName: 'arrow.down', environmentName },
		{ phase: 'Pulling' }
	);

	void (async () => {
		let failure: string | undefined;
		let progress: number | undefined;
		try {
			const { name, tag } = parseImageNameAndTag(reference);
			for await (const event of client.images.pullStream({
				envID: environmentID,
				options: { imageName: name, tag }
			})) {
				if (event.error) failure = event.error;
				const detail = event.progressDetail;
				if (detail?.current !== undefined && detail.total !== undefined && detail.total > 0) {
					progress = Math.min(Math.max(detail.current / detail.total, 0), 1);
					showActivityToast(id, title, progress);
					LiveActivities.update(id, { phase: 'Pulling', progress });
				}
			}
		} catch (error) {
			failure = isCancellation(error) ? 'Cancelled' : friendlyErrorMessage(error);
		}
		pullRunning = false;
		LiveActivities.finish(
			id,
			failure === undefined ? 'success' : failure === 'Cancelled' ? 'cancelled' : 'failure',
			progress
		);
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
