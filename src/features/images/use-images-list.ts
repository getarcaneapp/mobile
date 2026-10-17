import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
	performAllEnvironmentsMaintenance,
	performAllEnvironmentsPrune
} from '@/core/all-environments-actions';
import { BulkActionRunner } from '@/core/bulk-action-runner';
import { friendlyErrorMessage } from '@/core/errors';
import { ListSortOrder } from '@/core/list-sort-order';
import { ResourcePruneAction } from '@/core/resource-prune-action';
import { lightHaptic } from '@/features/containers/container-actions';
import { useDebounced, useOnChange } from '@/features/containers/hooks';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ImageSummary } from '@/sdk/models/image/ImageSummary';
import type { ImageUpdateResponse } from '@/sdk/models/imageUpdate/ImageUpdate';
import { User } from '@/sdk/models/user/User';
import { useAllEnvironmentsOperationStore } from '@/stores/all-environments-operation-store';
import { useClientManager } from '@/stores/client-manager';
import {
	useEnvironmentPagedList,
	type EnvironmentFetch,
	type EnvironmentItem
} from '@/stores/environment-paged-list';
import { useEnvironmentsStore, type ListEnvironment } from '@/stores/environments-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { systemColors } from '@/theme/colors';
import {
	useAllEnvironmentsMaintenanceConfirmation,
	type AllEnvironmentsMaintenanceAction
} from '@/ui/components/all-environments-maintenance';
import {
	useItemDeleteConfirmation,
	type DeleteConfirmationConfig
} from '@/ui/components/delete-confirmation';
import type { ImageUpdateState } from '@/ui/components/labels.types';
import type { StableListSection } from '@/ui/components/stable-sectioned-list.types';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { activityBatchScopedClient, imagesChanged } from './image-actions';
import {
	byteString,
	checkedUpdateResults,
	imageDisplayName,
	resolveImageUpdateState,
	taggedReferences,
	untaggedReference
} from './image-model';
import { useImageNavigation } from './image-routes';
import { useImagesFilter, useImagesFilterStore } from './images-filter-store';

const pageSize = 50;

export type ImageItem = EnvironmentItem<ImageSummary>;

export type ImageRowModel = {
	id: string;
	image: ImageItem;
	displayName: string;
	sizeText: string;
	updateState: ImageUpdateState;
};

export type ImageDestructive =
	| { kind: 'prune'; action: ResourcePruneAction }
	| { kind: 'delete'; image: ImageItem }
	| { kind: 'bulkDelete'; ids: string[] };

export type ImagesListProps = {
	environmentID: EnvironmentID;
	environmentName: string;
	allEnvironments?: boolean;
};

let listCounter = 0;

export function useImagesList({ environmentID, allEnvironments = false }: ImagesListProps) {
	const nav = useImageNavigation();
	const client = useClientManager((s) => s.client);
	const [listKey] = useState(() => `images-${++listCounter}`);
	const filter = useImagesFilter(listKey);
	const updateFilter = useImagesFilterStore((s) => s.update);
	useEffect(() => () => useImagesFilterStore.getState().remove(listKey), [listKey]);

	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);

	const [list, snapshot] = useEnvironmentPagedList<ImageSummary>(pageSize);
	const images = snapshot.items;

	const [updateInfo, setUpdateInfo] = useState<
		Record<EnvironmentID, Record<string, ImageUpdateResponse>>
	>({});
	const loadGeneration = useRef(0);

	const [isSelecting, setIsSelecting] = useState(false);
	const [selection, setSelection] = useState<string[]>([]);
	const [isBulkRunning, setIsBulkRunning] = useState(false);
	const [bulkRunningActionID, setBulkRunningActionID] = useState<string>();
	const [pendingDestructive, setPendingDestructive] = useState<ImageDestructive>();
	const [pendingMaintenance, setPendingMaintenance] = useState<AllEnvironmentsMaintenanceAction>();
	const isOperationRunning = useAllEnvironmentsOperationStore((s) => s.isRunning);
	const enabledEnvironments = useEnvironmentsStore((s) => s.environments).filter((e) => e.enabled);

	useEffect(() => {
		updateFilter(listKey, { environments: snapshot.environments });
	}, [listKey, snapshot.environments, updateFilter]);

	const listEnvironments: ListEnvironment[] = allEnvironments
		? snapshot.environments
		: [{ id: environmentID }];

	useClientManager((s) => s.accessGeneration);
	const currentUser = useClientManager((s) => s.currentUser);
	const isAdmin = currentUser !== undefined && User.isAdmin(currentUser);

	const showActionError = (error: unknown) =>
		Alert.alert('Something Went Wrong', friendlyErrorMessage(error), [
			{ text: 'OK', style: 'cancel' }
		]);

	const imagesPage = useCallback((): EnvironmentFetch<ImageSummary> | undefined => {
		const current = useClientManager.getState().client;
		if (!current) return undefined;
		return async (envID, start, limit) => {
			const response = await current.images.list({ envID, query: { start, limit } });
			return { items: response.data, pagination: response.pagination };
		};
	}, []);

	const loadUpdateInfo = useCallback(async (newImages: readonly ImageItem[]) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		const generation = loadGeneration.current;
		const clientGeneration = useClientManager.getState().clientGeneration;
		const refsByEnvironment = new Map<EnvironmentID, string[]>();
		for (const image of newImages) {
			const refs = taggedReferences(image.value.repoTags);
			if (refs.length === 0) continue;
			refsByEnvironment.set(image.environmentID, [
				...(refsByEnvironment.get(image.environmentID) ?? []),
				...refs
			]);
		}
		if (refsByEnvironment.size === 0) return;
		await Promise.all(
			[...refsByEnvironment].map(async ([envID, refs]) => {
				let map: Awaited<ReturnType<typeof current.images.updateInfoByRefs>>;
				try {
					map = await current.images.updateInfoByRefs({ envID, imageRefs: refs });
				} catch {
					return;
				}
				if (
					generation !== loadGeneration.current ||
					clientGeneration !== useClientManager.getState().clientGeneration
				)
					return;
				setUpdateInfo((info) => ({
					...info,
					[envID]: { ...info[envID], ...checkedUpdateResults(map) }
				}));
			})
		);
	}, []);

	const loadImages = useCallback(
		async (preservingLoadedRange = false) => {
			const fetch = imagesPage();
			if (!fetch) return;
			loadGeneration.current += 1;
			const generation = loadGeneration.current;
			const environments = await useEnvironmentsStore
				.getState()
				.listEnvironments(environmentID, allEnvironments);
			await list.reload(environments, fetch, { preservingLoadedRange });
			if (loadGeneration.current !== generation) return;
			const loaded = list.getSnapshot().items;
			const shown = new Set(loaded.map((image) => image.environmentID));
			setUpdateInfo((info) =>
				Object.fromEntries(Object.entries(info).filter(([envID]) => shown.has(envID)))
			);
			await loadUpdateInfo(loaded);
		},
		[imagesPage, list, environmentID, allEnvironments, loadUpdateInfo]
	);

	const loadMore = useCallback(async () => {
		const fetch = imagesPage();
		if (!fetch) return;
		const generation = loadGeneration.current;
		const loadedIDs = new Set(list.getSnapshot().items.map((image) => image.id));
		await list.loadMore(fetch);
		if (loadGeneration.current !== generation) return;
		await loadUpdateInfo(list.getSnapshot().items.filter((image) => !loadedIDs.has(image.id)));
	}, [imagesPage, list, loadUpdateInfo]);

	useFocusEffect(
		useCallback(() => {
			void loadImages(true);
		}, [loadImages])
	);

	const mutationVersion = useResourceMutationStore((s) =>
		(allEnvironments ? snapshot.environments.map((e) => e.id) : [environmentID]).reduce(
			(total, id) => total + (s.versions[`images::${id}`] ?? 0),
			0
		)
	);
	useOnChange(mutationVersion, () => void loadImages(true));
	useOnChange(client, () => void loadImages());

	const refresh = useCallback(() => loadImages(), [loadImages]);

	const sections: StableListSection<'used' | 'unused', ImageRowModel>[] = useMemo(() => {
		const query = debouncedSearch.toLowerCase();
		const filtered = images
			.filter((image) => {
				if (
					filter.environmentFilter !== undefined &&
					image.environmentID !== filter.environmentFilter
				)
					return false;
				const name = imageDisplayName(image.value);
				const matchesSearch =
					query === '' ||
					name.toLowerCase().includes(query) ||
					image.value.id.toLowerCase().includes(query);
				const isTagged = image.value.repoTags.some((tag) => tag !== untaggedReference);
				const matchesTags =
					filter.tagsFilter === 'All' ||
					(filter.tagsFilter === 'Tagged' && isTagged) ||
					(filter.tagsFilter === 'Untagged' && !isTagged);
				return matchesSearch && matchesTags;
			})
			.sort((lhs, rhs) =>
				ListSortOrder.compare(
					filter.sortOrder,
					imageDisplayName(lhs.value),
					imageDisplayName(rhs.value)
				)
			);
		const used: ImageRowModel[] = [];
		const unused: ImageRowModel[] = [];
		for (const image of filtered) {
			const row: ImageRowModel = {
				id: image.id,
				image,
				displayName: imageDisplayName(image.value),
				sizeText: byteString(image.value.size),
				updateState: resolveImageUpdateState(
					image.value.updateInfo,
					image.value.repoTags,
					updateInfo[image.environmentID] ?? {}
				)
			};
			(image.value.inUse ? used : unused).push(row);
		}
		return [
			{ id: 'used', title: 'Used', items: used },
			{ id: 'unused', title: 'Unused', items: unused }
		];
	}, [
		images,
		debouncedSearch,
		filter.environmentFilter,
		filter.tagsFilter,
		filter.sortOrder,
		updateInfo
	]);

	useEffect(() => {
		const valid = new Set(images.map((image) => image.id));
		setSelection((current) => {
			const next = current.filter((id) => valid.has(id));
			return next.length === current.length ? current : next;
		});
	}, [images]);

	const activeFilterCount =
		(filter.tagsFilter !== 'All' ? 1 : 0) + (filter.environmentFilter !== undefined ? 1 : 0);

	const enterSelectionMode = useCallback(() => {
		lightHaptic();
		setIsSelecting(true);
	}, []);

	const exitSelectionMode = useCallback(() => {
		setIsSelecting(false);
		setSelection([]);
	}, []);

	const toggleSelected = useCallback((id: string) => {
		setSelection((current) =>
			current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
		);
	}, []);

	const selectedImageIDs = images
		.filter((image) => selection.includes(image.id))
		.map((image) => image.id);

	const bulkPrimaryItem: ActionButtonItem | undefined =
		selection.length === 0
			? undefined
			: {
					id: 'bulk-delete',
					title: 'Delete',
					systemImage: 'trash',
					tint: systemColors.red,
					action: () => setPendingDestructive({ kind: 'bulkDelete', ids: selectedImageIDs })
				};

	const pruneImages = async (action: ResourcePruneAction) => {
		if (allEnvironments) {
			await performAllEnvironmentsPrune(action, enabledEnvironments);
			return;
		}
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			await ResourcePruneAction.perform(action, current, environmentID);
			imagesChanged(environmentID);
			showToast(Toasts.success('Images pruned'));
		} catch (error) {
			showActionError(error);
		}
	};

	const removeImage = async (image: ImageItem) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			await current.images.remove({ envID: image.environmentID, id: image.value.id });
			list.updateItems((items) => items.filter((item) => item.id !== image.id));
			imagesChanged(image.environmentID);
			showToast(Toasts.success('Image removed'));
		} catch (error) {
			showActionError(error);
		}
	};

	const bulkDeleteImages = async (ids: string[]) => {
		const baseClient = useClientManager.getState().client;
		if (!baseClient) return;
		setIsBulkRunning(true);
		setBulkRunningActionID('bulk-delete');
		try {
			let scoped;
			try {
				scoped = activityBatchScopedClient(baseClient);
			} catch {
				showToast(Toasts.error("Couldn't start bulk deletion"));
				return;
			}
			const targets = list.getSnapshot().items.filter((image) => ids.includes(image.id));
			const byID = new Map(targets.map((target) => [target.id, target]));
			const result = await BulkActionRunner.run(
				targets.map((target) => target.id),
				async (id) => {
					const image = byID.get(id);
					if (!image) return;
					await scoped.images.remove({ envID: image.environmentID, id: image.value.id });
				}
			);
			const failedIDs = new Set(result.failed.map((failure) => failure.id));
			const removedIDs = new Set(
				targets.map((target) => target.id).filter((id) => !failedIDs.has(id))
			);
			list.updateItems((items) => items.filter((item) => !removedIDs.has(item.id)));
			for (const environment of new Set(targets.map((target) => target.environmentID)))
				imagesChanged(environment);
			exitSelectionMode();
			if (result.failed.length === 0) {
				showToast(
					Toasts.success(`Deleted ${result.succeeded} image${result.succeeded === 1 ? '' : 's'}`)
				);
			} else {
				showToast(Toasts.error(`${result.failed.length} of ${targets.length} failed`));
			}
		} finally {
			setIsBulkRunning(false);
			setBulkRunningActionID(undefined);
		}
	};

	useItemDeleteConfirmation(
		pendingDestructive,
		setPendingDestructive,
		(pending): DeleteConfirmationConfig => {
			switch (pending.kind) {
				case 'prune':
					return {
						title: ResourcePruneAction.title(pending.action),
						message: allEnvironments
							? ResourcePruneAction.allEnvironmentsMessage(pending.action)
							: ResourcePruneAction.message(pending.action),
						icon: 'trash',
						actions: [{ title: 'Prune', action: () => void pruneImages(pending.action) }],
						dismissOnConfirm: false
					};
				case 'delete':
					return {
						title: 'Delete Image',
						message: `Delete “${imageDisplayName(pending.image.value)}”? This removes the image from the host.`,
						icon: 'trash',
						actions: [{ title: 'Delete', action: () => void removeImage(pending.image) }],
						dismissOnConfirm: false
					};
				case 'bulkDelete':
					return {
						title: 'Delete Images',
						message: `Delete ${pending.ids.length} selected image${pending.ids.length === 1 ? '' : 's'} from the host.`,
						icon: 'trash',
						actions: [{ title: 'Delete', action: () => void bulkDeleteImages(pending.ids) }],
						dismissOnConfirm: false
					};
			}
		}
	);

	useAllEnvironmentsMaintenanceConfirmation(pendingMaintenance, setPendingMaintenance, (action) => {
		void performAllEnvironmentsMaintenance(action, enabledEnvironments);
	});

	const openUpdates = (envID: EnvironmentID) =>
		nav.openUpdates(
			envID,
			list
				.getSnapshot()
				.items.filter((image) => image.environmentID === envID)
				.map((image) => image.value)
		);

	return {
		listKey,
		allEnvironments,
		environmentID,
		snapshot,
		images,
		sections,
		listEnvironments,
		isAdmin,
		setSearchText,
		activeFilterCount,
		loadImages,
		loadMore,
		refresh,
		openFilter: () => nav.openFilter(listKey),
		openDetail: (item: ImageItem) => nav.openDetail(item.environmentID, item.value),
		openRegistries: nav.openRegistries,
		openUpdates,
		openSecurity: () => nav.openSecurity(environmentID),
		presentPull: (envID: EnvironmentID) => nav.openPull(envID),
		presentUpload: (envID: EnvironmentID) => nav.openUpload(envID),
		presentPruneOptions: (envID: EnvironmentID) => nav.openPrune(envID),
		requestPrune: (action: ResourcePruneAction) => setPendingDestructive({ kind: 'prune', action }),
		requestDelete: (image: ImageItem) => setPendingDestructive({ kind: 'delete', image }),
		isOperationRunning,
		selectMaintenance: setPendingMaintenance,
		isSelecting,
		selection,
		enterSelectionMode,
		exitSelectionMode,
		toggleSelected,
		bulkToolbar: {
			primary: bulkPrimaryItem,
			runningItemID: bulkRunningActionID,
			isDisabled: isBulkRunning,
			resourceName: `${selection.length} selected`,
			active: isSelecting && selection.length > 0
		}
	};
}

export type ImagesListModel = ReturnType<typeof useImagesList>;
