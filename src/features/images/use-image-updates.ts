import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { routePayloads } from '@/features/containers/container-routes';
import type { ImageSummary } from '@/sdk/models/image/ImageSummary';
import { ImageUpdateInfo } from '@/sdk/models/image/ImageUpdateInfo';
import type { ImageUpdateResponse, ImageUpdateSummary } from '@/sdk/models/imageUpdate/ImageUpdate';
import { useClientManager } from '@/stores/client-manager';
import { useImageUpdateCountStore } from '@/stores/image-update-count-store';
import { showToast, Toasts } from '@/ui/toast';

import { taggedReferences } from './image-model';

export function useImageUpdates() {
	const { envID = '0', token } = useLocalSearchParams<{ envID?: string; token?: string }>();
	const environmentID = envID;
	const [images] = useState<ImageSummary[]>(() => routePayloads.get<ImageSummary[]>(token) ?? []);
	const [summary, setSummary] = useState<ImageUpdateSummary>();
	const [byRef, setByRef] = useState<Record<string, ImageUpdateResponse>>({});
	const [isScanning, setIsScanning] = useState(false);
	const [checkingRef, setCheckingRef] = useState<string>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const [loadingSummary, setLoadingSummary] = useState(false);

	const taggedRefs = useMemo(
		() => images.flatMap((image) => taggedReferences(image.repoTags)),
		[images]
	);

	const loadSummary = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setLoadingSummary(true);
		try {
			const loaded = await client.images.updateSummary({ envID: environmentID });
			setSummary(loaded);
			const manager = useClientManager.getState();
			useImageUpdateCountStore
				.getState()
				.setCount(loaded.imagesWithUpdates, environmentID, manager.client, manager.currentUser?.id);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setLoadingSummary(false);
		}
	}, [environmentID]);

	const loadByRefs = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client || taggedRefs.length === 0) return;
		try {
			const map = await client.images.updateInfoByRefs({
				envID: environmentID,
				imageRefs: taggedRefs
			});
			const next: Record<string, ImageUpdateResponse> = {};
			for (const [ref, info] of Object.entries(map))
				if (info) next[ref] = ImageUpdateInfo.asUpdateResponse(info);
			setByRef(next);
		} catch {}
	}, [environmentID, taggedRefs]);

	const reload = useCallback(async () => {
		await loadSummary();
		await loadByRefs();
	}, [loadSummary, loadByRefs]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const recheck = async (ref: string) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setCheckingRef(ref);
		try {
			const result = await client.images.checkUpdateByRef({ envID: environmentID, imageRef: ref });
			setByRef((current) => ({ ...current, [ref]: result }));
			await loadSummary();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setCheckingRef(undefined);
		}
	};

	const scanAll = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsScanning(true);
		try {
			await client.images.checkAllUpdates({ envID: environmentID });
			await loadSummary();
			await loadByRefs();
			showToast(Toasts.success('Update check complete'));
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsScanning(false);
		}
	};

	return {
		summary,
		byRef,
		taggedRefs,
		isScanning,
		checkingRef,
		errorMessage,
		loadingSummary,
		reload,
		recheck: (ref: string) => void recheck(ref),
		scanAll: () => void scanAll()
	};
}
