import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { performAllEnvironmentsMaintenance } from '@/core/all-environments-actions';
import { friendlyErrorMessage } from '@/core/errors';
import { ListSortOrder, localizedStandardCompare } from '@/core/list-sort-order';
import { PaginationLoader } from '@/core/networking/pagination-loader';
import {
	RemoteDataLimitError,
	RemoteDataLimits,
	saturatingAdd
} from '@/core/networking/remote-data-limits';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { ImageSummary, ImageUsedBy } from '@/sdk/models/image/ImageSummary';
import { ImageUpdateInfo } from '@/sdk/models/image/ImageUpdateInfo';
import type { ImageUpdateResponse, ImageUpdateSummary } from '@/sdk/models/imageUpdate/ImageUpdate';
import { useClientManager } from '@/stores/client-manager';
import { useContainerDeploymentStore } from '@/stores/container-deployment-store';
import { environmentDisplayName } from '@/stores/environments-store';
import { useImageUpdateCountStore } from '@/stores/image-update-count-store';
import { useResourceVersionIn } from '@/stores/resource-mutation-store';
import type { AllEnvironmentsMaintenanceAction } from '@/ui/components/all-environments-maintenance';
import { useAllEnvironmentsMaintenanceConfirmation } from '@/ui/components/all-environments-maintenance';
import { showToast, Toasts } from '@/ui/toast';

import {
	actionableConsumers,
	containsInsensitive,
	makeBucket,
	OutdatedImage,
	outdatedImages,
	primaryRef,
	resolvedInfo,
	resolveUpdateTargets,
	rowKey,
	updateCount,
	type EnvUpdateBucket,
	type UpdateTarget
} from './updates-logic';

export type ImageDetailTarget = { envID: string; imageID: string };

export type EnvironmentImageUpdateItem = {
	id: string;
	bucket: EnvUpdateBucket;
	image: OutdatedImage;
};

export type ImageDetailState =
	| { kind: 'image'; item: OutdatedImage; hasUpdate: boolean; bucket: EnvUpdateBucket }
	| { kind: 'updatedAway' };

type EnvLoadResult = {
	index: number;
	summary?: ImageUpdateSummary;
	images: ImageSummary[];
	byRef: Record<string, ImageUpdateResponse>;
	totalImages: number;
	error?: string;
};

async function fetchEnv(
	index: number,
	envID: EnvironmentID,
	client: ArcaneClient
): Promise<EnvLoadResult> {
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
	return { index, summary, images, byRef, totalImages: images.length, error };
}

export type ImageUpdatesModel = ReturnType<typeof useImageUpdates>;

export function useImageUpdates({
	dismissOnOperationStart = false,
	onDismiss
}: {
	dismissOnOperationStart?: boolean;
	onDismiss?: () => void;
}) {
	const client = useClientManager((s) => s.client);
	const currentUserID = useClientManager((s) => s.currentUser?.id);
	const allEnvironmentsPreview = useClientManager((s) => s.allEnvironmentsPreview);
	const deploymentRunning = useContainerDeploymentStore((s) => s.isRunning);

	const [buckets, setBuckets] = useState<EnvUpdateBucket[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
	const [environmentLoadError, setEnvironmentLoadError] = useState<string>();
	const [search, setSearch] = useState('');
	const [environmentFilter, setEnvironmentFilter] = useState<string>();
	const [sortOrder, setSortOrder] = useState<ListSortOrder>('ascending');
	const [showsFilters, setShowsFilters] = useState(false);
	const [checkingKeys, setCheckingKeys] = useState<ReadonlySet<string>>(new Set());
	const [updatingKeys, setUpdatingKeys] = useState<ReadonlySet<string>>(new Set());
	const [rescanningEnvID, setRescanningEnvID] = useState<string>();
	const [pendingMaintenanceAction, setPendingMaintenanceAction] =
		useState<AllEnvironmentsMaintenanceAction>();
	const [updaterRunTarget, setUpdaterRunTarget] = useState<string>();
	const [detailTarget, setDetailTarget] = useState<ImageDetailTarget>();

	const updatingKeysRef = useRef(updatingKeys);
	updatingKeysRef.current = updatingKeys;
	const bucketsRef = useRef(buckets);
	bucketsRef.current = buckets;
	const loadingRef = useRef({ isLoading, hasLoadedOnce });
	loadingRef.current = { isLoading, hasLoadedOnce };
	const generation = useRef(0);
	useEffect(
		() => () => {
			generation.current += 1;
		},
		[]
	);

	const publishUpdateCount = useCallback((current: EnvUpdateBucket[]) => {
		const counts: Record<string, number> = {};
		for (const bucket of current)
			counts[bucket.id] = saturatingAdd(counts[bucket.id] ?? 0, updateCount(bucket));
		useImageUpdateCountStore
			.getState()
			.setCounts(
				counts,
				useClientManager.getState().client,
				useClientManager.getState().currentUser?.id
			);
	}, []);

	const commit = (next: EnvUpdateBucket[]) => {
		bucketsRef.current = next;
		setBuckets(next);
	};

	const apply = (result: EnvLoadResult) => {
		const current = bucketsRef.current;
		const bucket = current[result.index];
		if (!bucket) return;
		const next = [...current];
		next[result.index] = {
			...bucket,
			summary: result.summary,
			images: result.images,
			byRef: result.byRef,
			totalImages: result.totalImages,
			error: result.error,
			loading: false
		};
		commit(next);
	};

	const loadAll = useCallback(async () => {
		const cached = cachedClient();
		const activeClient = useClientManager.getState().client;
		if (!cached || !activeClient) return;
		const token = ++generation.current;
		const isCurrent = () => generation.current === token;
		if (!loadingRef.current.hasLoadedOnce) setIsLoading(true);
		const finish = () => {
			if (!isCurrent()) return;
			setIsLoading(false);
			setHasLoadedOnce(true);
		};

		let envs: Environment[];
		try {
			envs = await cached.getAllPagesGlobal(
				'environments',
				async (start, limit) => {
					const response = await activeClient.environments.list({
						query: { start, limit, sortBy: 'name', sortOrder: 'asc' }
					});
					return { items: response.data, pagination: response.pagination };
				},
				{ maximumItems: RemoteDataLimits.maximumEnvironments }
			);
			if (envs.length > RemoteDataLimits.maximumEnvironments) {
				throw RemoteDataLimitError.collectionTooLarge(RemoteDataLimits.maximumEnvironments);
			}
			if (!isCurrent()) return;
			setEnvironmentLoadError(undefined);
		} catch (error) {
			if (!isCurrent()) return;
			setEnvironmentLoadError(friendlyErrorMessage(error));
			commit([]);
			publishUpdateCount([]);
			finish();
			return;
		}

		commit(envs.map((env) => makeBucket(env, true)));
		if (envs.length === 0) {
			publishUpdateCount([]);
			finish();
			return;
		}

		await Promise.all(
			envs.map(async (env, index) => {
				const result = await fetchEnv(index, env.id, activeClient);
				if (isCurrent()) apply(result);
			})
		);
		if (isCurrent()) {
			publishUpdateCount(bucketsRef.current);
			finish();
		}
	}, [publishUpdateCount]);

	useEffect(() => {
		void loadAll();
	}, [loadAll, client]);

	const wasRunning = useRef(deploymentRunning);
	useEffect(() => {
		const was = wasRunning.current;
		wasRunning.current = deploymentRunning;
		if (!was || deploymentRunning || updatingKeysRef.current.size === 0) return;
		setUpdatingKeys(new Set());
		void loadAll();
	}, [deploymentRunning, loadAll]);

	const imageMutationVersion = useResourceVersionIn(
		'images',
		useMemo(() => buckets.map((b) => ({ id: b.id })), [buckets])
	);
	const lastMutationVersion = useRef(imageMutationVersion);
	useEffect(() => {
		if (lastMutationVersion.current === imageMutationVersion) return;
		lastMutationVersion.current = imageMutationVersion;
		if (!loadingRef.current.hasLoadedOnce || loadingRef.current.isLoading) return;
		void loadAll();
	}, [imageMutationVersion, loadAll]);

	const updateItemCount = useMemo(
		() => buckets.reduce((count, bucket) => count + outdatedImages(bucket).length, 0),
		[buckets]
	);

	const filteredBuckets = useMemo(
		() =>
			buckets.filter(
				(bucket) => environmentFilter === undefined || bucket.id === environmentFilter
			),
		[buckets, environmentFilter]
	);

	const visibleUpdates = useMemo<EnvironmentImageUpdateItem[]>(() => {
		const items = filteredBuckets
			.flatMap((bucket) =>
				outdatedImages(bucket).map((image) => ({ id: rowKey(bucket.id, image.id), bucket, image }))
			)
			.filter(
				(item) =>
					search === '' ||
					containsInsensitive(environmentDisplayName(item.bucket.env), search) ||
					containsInsensitive(item.image.ref, search)
			);
		return items.sort((a, b) => {
			const aName = OutdatedImage.repoDisplayName(a.image);
			const bName = OutdatedImage.repoDisplayName(b.image);
			if (localizedStandardCompare(aName, bName) !== 0)
				return ListSortOrder.compare(sortOrder, aName, bName);
			const environmentOrder = localizedStandardCompare(
				environmentDisplayName(a.bucket.env),
				environmentDisplayName(b.bucket.env)
			);
			if (environmentOrder !== 0) return environmentOrder;
			return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
		});
	}, [filteredBuckets, search, sortOrder]);

	const anyWorkInFlight = (bucket: EnvUpdateBucket) =>
		deploymentRunning ||
		[...updatingKeys].some((key) => key.startsWith(`${bucket.id}::`)) ||
		rescanningEnvID !== undefined;

	const detailState = (target: ImageDetailTarget): ImageDetailState => {
		const bucket = buckets.find((b) => b.id === target.envID);
		const image = bucket?.images.find((i) => i.id === target.imageID);
		const ref = image ? primaryRef(image) : undefined;
		if (!bucket || !image || ref === undefined) return { kind: 'updatedAway' };
		const info = resolvedInfo(image, ref, bucket);
		return {
			kind: 'image',
			item: OutdatedImage.make(
				image,
				ref,
				info ?? { hasUpdate: false, updateType: '', currentVersion: '', responseTimeMs: 0 }
			),
			hasUpdate: info?.hasUpdate === true,
			bucket
		};
	};

	const freshContainers = async (bucket: EnvUpdateBucket): Promise<ContainerSummary[]> => {
		const activeClient = useClientManager.getState().client;
		const cached = cachedClient();
		if (!activeClient || !cached) return [];
		const envID = bucket.env.id;
		const path = activeClient.rest.environmentPath(envID, 'containers');
		try {
			return await cached.getAllPages(path, envID, async (start, limit) => {
				const response = await activeClient.containers.list({ envID, query: { start, limit } });
				return { items: response.data, pagination: response.pagination };
			});
		} catch {
			return [];
		}
	};

	const startUpdateOperation = (
		targets: UpdateTarget[],
		displayName: string,
		key: string,
		bucket: EnvUpdateBucket
	) => {
		const first = targets[0];
		if (!first) return;
		const started = useContainerDeploymentStore.getState().start({
			kind: 'containerUpdate',
			envID: bucket.env.id,
			targetID: first.id,
			targetName: displayName,
			environmentName: environmentDisplayName(bucket.env),
			updateTargets: targets
		});
		if (!started) return;
		setUpdatingKeys((keys) => new Set([...keys, key]));
		setDetailTarget(undefined);
		if (dismissOnOperationStart) onDismiss?.();
	};

	const startImageUpdate = async (item: OutdatedImage, bucket: EnvUpdateBucket) => {
		const targets = resolveUpdateTargets(
			OutdatedImage.consumers(item),
			item,
			await freshContainers(bucket)
		);
		if (targets.length === 0) {
			showToast(
				Toasts.error(
					`No matching containers found for ${OutdatedImage.repoDisplayName(item)} — try refreshing`
				)
			);
			return;
		}
		startUpdateOperation(
			targets,
			OutdatedImage.repoDisplayName(item),
			rowKey(bucket.id, item.image.id),
			bucket
		);
	};

	const startConsumerUpdate = async (
		consumer: ImageUsedBy,
		item: OutdatedImage,
		bucket: EnvUpdateBucket
	) => {
		const targets = resolveUpdateTargets([consumer], item, await freshContainers(bucket));
		if (targets.length === 0) {
			showToast(Toasts.error(`No matching containers found for ${consumer.name} — try refreshing`));
			return;
		}
		const key =
			consumer.id !== undefined ? rowKey(bucket.id, consumer.id) : rowKey(bucket.id, item.image.id);
		startUpdateOperation(targets, consumer.name, key, bucket);
	};

	const recheckAll = async (bucket: EnvUpdateBucket) => {
		const activeClient = useClientManager.getState().client;
		if (!activeClient) return;
		setRescanningEnvID(bucket.id);
		try {
			const envID = bucket.env.id;
			const postedMap = await activeClient.images.checkAllUpdates({ envID }).catch(() => undefined);
			const index = bucketsRef.current.findIndex((b) => b.id === bucket.id);
			if (index < 0) return;
			const result = await fetchEnv(index, envID, activeClient);
			if (postedMap) {
				for (const [ref, response] of Object.entries(postedMap))
					if (response) result.byRef[ref] = response;
			}
			apply(result);
			publishUpdateCount(bucketsRef.current);
		} finally {
			setRescanningEnvID(undefined);
		}
	};

	const recheck = async (bucket: EnvUpdateBucket, ref: string) => {
		const activeClient = useClientManager.getState().client;
		if (!activeClient) return;
		const key = rowKey(bucket.id, ref);
		setCheckingKeys((keys) => new Set([...keys, key]));
		try {
			const response = await activeClient.images.checkUpdateByRef({
				envID: bucket.env.id,
				imageRef: ref
			});
			const current = bucketsRef.current;
			const index = current.findIndex((b) => b.id === bucket.id);
			const existing = current[index];
			if (!existing) return;
			const next = [...current];
			next[index] = { ...existing, byRef: { ...existing.byRef, [ref]: response } };
			commit(next);
			publishUpdateCount(next);
		} catch {
			showToast(Toasts.error(`Couldn't check ${ref}`));
		} finally {
			setCheckingKeys((keys) => {
				const next = new Set(keys);
				next.delete(key);
				return next;
			});
		}
	};

	const copyRef = (item: OutdatedImage) => {
		void Clipboard.setStringAsync(item.ref);
		showToast(Toasts.copied('Image ref copied'));
	};

	useAllEnvironmentsMaintenanceConfirmation(
		pendingMaintenanceAction,
		setPendingMaintenanceAction,
		(action) => {
			void performAllEnvironmentsMaintenance(
				action,
				bucketsRef.current.map((bucket) => bucket.env)
			);
		}
	);

	return {
		allEnvironmentsPreview,
		currentUserID,
		buckets,
		isLoading,
		hasLoadedOnce,
		environmentLoadError,
		search,
		setSearch,
		environmentFilter,
		setEnvironmentFilter,
		sortOrder,
		setSortOrder,
		showsFilters,
		setShowsFilters,
		checkingKeys,
		updatingKeys,
		rescanningEnvID,
		setPendingMaintenanceAction,
		updaterRunTarget,
		setUpdaterRunTarget,
		detailTarget,
		setDetailTarget,
		updateItemCount,
		filteredBuckets,
		visibleUpdates,
		loadAll,
		anyWorkInFlight,
		detailState,
		actionableConsumers,
		outdatedImages,
		startImageUpdate,
		startConsumerUpdate,
		recheckAll,
		recheck,
		copyRef
	};
}
