import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { performAllEnvironmentsPrune } from '@/core/all-environments-actions';
import { hasPermission } from '@/core/auth/permissions';
import { BulkActionRunner } from '@/core/bulk-action-runner';
import { friendlyErrorMessage } from '@/core/errors';
import { cachedClient } from '@/core/networking/use-cached-client';
import { ResourcePruneAction } from '@/core/resource-prune-action';
import type { EnvironmentID } from '@/sdk/client/environment';
import { Permission } from '@/sdk/models/role/Permission';
import type { Volume, VolumeSizeInfo } from '@/sdk/models/volume/Volume';
import { useAllEnvironmentsOperationStore } from '@/stores/all-environments-operation-store';
import { useClientManager } from '@/stores/client-manager';
import {
	pinnedEnvironmentItemIDs,
	toggleEnvironmentItemPin,
	useEnvironmentPagedList,
	type EnvironmentFetch
} from '@/stores/environment-paged-list';
import { useEnvironmentsStore, type ListEnvironment } from '@/stores/environments-store';
import { usePinnedItemsStore } from '@/stores/pinned-items-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { systemColors } from '@/theme/colors';
import {
	useItemDeleteConfirmation,
	type DeleteConfirmationConfig
} from '@/ui/components/delete-confirmation';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { useDebounced, useOnChange } from '@/features/containers/hooks';

import {
	computeVolumeSections,
	invalidateVolumeCaches,
	lightHaptic,
	VolumeRename,
	type VolumeItem
} from './volume-model';
import { useVolumeNavigation } from './volume-routes';
import { showErrorAlert } from './volume-support';
import {
	useVolumesFilter,
	useVolumesFilterStore,
	volumesActiveFilterCount
} from './volumes-filter-store';

const pageSize = 50;

export type VolumeDestructive =
	| { kind: 'prune' }
	| { kind: 'delete'; volume: VolumeItem }
	| { kind: 'bulkDelete'; ids: string[] };

let listCounter = 0;

export type VolumesListProps = {
	environmentID: EnvironmentID;
	environmentName: string;
	allEnvironments?: boolean;
};

export function useVolumesList({ environmentID, allEnvironments = false }: VolumesListProps) {
	const nav = useVolumeNavigation();
	const client = useClientManager((s) => s.client);
	const [listKey] = useState(() => `volumes-${++listCounter}`);
	const filter = useVolumesFilter(listKey);
	const updateFilter = useVolumesFilterStore((s) => s.update);
	useEffect(() => () => useVolumesFilterStore.getState().remove(listKey), [listKey]);

	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);

	const [list, snapshot] = useEnvironmentPagedList<Volume>(pageSize);
	const volumes = snapshot.items;
	const [sizes, setSizes] = useState<Record<EnvironmentID, Record<string, number>>>({});
	const sizesRef = useRef(sizes);
	sizesRef.current = sizes;

	const pinVersion = usePinnedItemsStore((s) => s.version);
	const allEnvironmentsList = useEnvironmentsStore((s) => s.environments);

	const [isSelecting, setIsSelecting] = useState(false);
	const [selection, setSelection] = useState<string[]>([]);
	const [isBulkRunning, setIsBulkRunning] = useState(false);
	const [bulkRunningActionID, setBulkRunningActionID] = useState<string>();
	const [pendingDestructive, setPendingDestructive] = useState<VolumeDestructive>();
	const isOperationRunning = useAllEnvironmentsOperationStore((s) => s.isRunning);

	useEffect(() => {
		updateFilter(listKey, { environments: snapshot.environments });
	}, [listKey, snapshot.environments, updateFilter]);

	const volumesPage = useCallback((): EnvironmentFetch<Volume> | undefined => {
		const current = useClientManager.getState().client;
		if (!current) return undefined;
		return async (envID, start, limit) => {
			const response = await current.volumes.list({ envID, query: { start, limit } });
			return { items: response.data, pagination: response.pagination };
		};
	}, []);

	const loadSizesFor = useCallback(async (environmentID: EnvironmentID) => {
		const current = useClientManager.getState().client;
		const cached = cachedClient();
		if (!current || !cached) return;
		try {
			const path = current.rest.environmentPath(environmentID, 'volumes/sizes');
			const entries = await cached.get<VolumeSizeInfo[]>(path, environmentID);
			const map: Record<string, number> = {};
			for (const entry of entries) map[entry.name] = entry.size;
			setSizes((s) => ({ ...s, [environmentID]: map }));
		} catch {}
	}, []);

	const loadSizes = useCallback(
		(environmentIDs: EnvironmentID[]) => Promise.all(environmentIDs.map((id) => loadSizesFor(id))),
		[loadSizesFor]
	);

	const loadVolumes = useCallback(
		async (preservingLoadedRange = false) => {
			const fetch = volumesPage();
			if (!fetch) return;
			const environments = await useEnvironmentsStore
				.getState()
				.listEnvironments(environmentID, allEnvironments);
			const sizesLoad = loadSizes(environments.map((e) => e.id));
			await list.reload(environments, fetch, { preservingLoadedRange });
			await sizesLoad;
		},
		[volumesPage, list, environmentID, allEnvironments, loadSizes]
	);

	const loadMore = useCallback(async () => {
		const fetch = volumesPage();
		if (!fetch) return;
		await list.loadMore(fetch);
		const missing = list
			.getSnapshot()
			.environments.map((e) => e.id)
			.filter((id) => sizesRef.current[id] === undefined);
		if (missing.length > 0) await loadSizes(missing);
	}, [volumesPage, list, loadSizes]);

	useFocusEffect(
		useCallback(() => {
			void loadVolumes(true);
		}, [loadVolumes])
	);

	const mutationVersion = useResourceMutationStore((s) =>
		(allEnvironments ? snapshot.environments.map((e) => e.id) : [environmentID]).reduce(
			(total, id) => total + (s.versions[`volumes::${id}`] ?? 0),
			0
		)
	);
	useOnChange(mutationVersion, () => void loadVolumes(true));
	useOnChange(client, () => void loadVolumes());

	const pinnedIDs = useMemo(() => {
		void pinVersion;
		return pinnedEnvironmentItemIDs('volume', volumes);
	}, [volumes, pinVersion]);

	const sections = useMemo(
		() =>
			computeVolumeSections(
				volumes,
				{
					search: debouncedSearch,
					environmentFilter: filter.environmentFilter,
					scopeFilter: filter.scopeFilter,
					sortOrder: filter.sortOrder
				},
				pinnedIDs
			),
		[
			volumes,
			debouncedSearch,
			filter.environmentFilter,
			filter.scopeFilter,
			filter.sortOrder,
			pinnedIDs
		]
	);

	useEffect(() => {
		const valid = new Set(volumes.map((v) => v.id));
		setSelection((current) => {
			const next = current.filter((id) => valid.has(id));
			return next.length === current.length ? current : next;
		});
	}, [volumes]);

	const size = useCallback(
		(item: VolumeItem) => sizes[item.environmentID]?.[item.value.name],
		[sizes]
	);

	useClientManager((s) => s.accessGeneration);
	const listEnvironments: ListEnvironment[] = allEnvironments
		? snapshot.environments
		: [{ id: environmentID }];
	const createEnvironments = allEnvironments
		? listEnvironments.filter((e) => hasPermission(Permission.Volumes.create, e.id))
		: listEnvironments;
	const enabledEnvironments = allEnvironmentsList.filter((e) => e.enabled);

	const togglePin = useCallback((item: VolumeItem) => toggleEnvironmentItemPin(item, 'volume'), []);
	const togglePinAfterSwipe = useCallback(
		(item: VolumeItem) => setTimeout(() => togglePin(item), 250),
		[togglePin]
	);

	const exitSelectionMode = useCallback(() => {
		setIsSelecting(false);
		setSelection([]);
	}, []);

	const enterSelectionMode = useCallback(() => {
		lightHaptic();
		setIsSelecting(true);
	}, []);

	const toggleSelected = useCallback((id: string) => {
		setSelection((current) =>
			current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
		);
	}, []);

	const deleteVolume = async (volume: VolumeItem) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			await current.volumes.remove({ envID: volume.environmentID, name: volume.value.name });
			list.updateItems((items) => items.filter((item) => item.id !== volume.id));
			invalidateVolumeCaches(volume.environmentID);
			useResourceMutationStore.getState().markChanged('volumes', volume.environmentID);
			showToast(Toasts.success('Volume deleted'));
		} catch (error) {
			showErrorAlert('Action Failed', friendlyErrorMessage(error));
		}
	};

	const pruneVolumes = async () => {
		if (allEnvironments) {
			await performAllEnvironmentsPrune('volumes', enabledEnvironments);
			return;
		}
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			await ResourcePruneAction.perform('volumes', current, environmentID);
			invalidateVolumeCaches(environmentID);
			useResourceMutationStore.getState().markChanged('volumes', environmentID);
			showToast(Toasts.success('Volumes pruned'));
		} catch (error) {
			showErrorAlert('Action Failed', friendlyErrorMessage(error));
		}
	};

	const bulkDeleteVolumes = async (ids: string[]) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		setIsBulkRunning(true);
		setBulkRunningActionID('bulk-delete');
		try {
			const targets = list.getSnapshot().items.filter((v) => ids.includes(v.id));
			const byID = new Map(targets.map((t) => [t.id, t]));
			const result = await BulkActionRunner.run(
				targets.map((t) => t.id),
				async (id) => {
					const volume = byID.get(id);
					if (!volume) return;
					await current.volumes.remove({ envID: volume.environmentID, name: volume.value.name });
				}
			);
			const failedIDs = new Set(result.failed.map((f) => f.id));
			const removed = targets.filter((t) => !failedIDs.has(t.id));
			const removedIDs = new Set(removed.map((t) => t.id));
			list.updateItems((items) => items.filter((item) => !removedIDs.has(item.id)));
			setSizes((s) => {
				const next = { ...s };
				for (const volume of removed) {
					const map = next[volume.environmentID];
					if (!map) continue;
					const { [volume.value.name]: _removed, ...rest } = map;
					next[volume.environmentID] = rest;
				}
				return next;
			});
			for (const environment of new Set(targets.map((t) => t.environmentID))) {
				invalidateVolumeCaches(environment);
				useResourceMutationStore.getState().markChanged('volumes', environment);
			}
			exitSelectionMode();
			if (result.failed.length === 0) {
				showToast(
					Toasts.success(`Deleted ${result.succeeded} volume${result.succeeded === 1 ? '' : 's'}`)
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
						title: 'Prune Unused Volumes',
						message: allEnvironments
							? ResourcePruneAction.allEnvironmentsMessage('volumes')
							: 'All unused volumes will be permanently deleted.',
						icon: 'trash',
						actions: [{ title: 'Prune', action: () => void pruneVolumes() }],
						dismissOnConfirm: false
					};
				case 'delete':
					return {
						title: 'Delete Volume',
						message: `Delete “${pending.volume.value.name}”? This cannot be undone.`,
						icon: 'trash',
						actions: [{ title: 'Delete', action: () => void deleteVolume(pending.volume) }],
						dismissOnConfirm: false
					};
				case 'bulkDelete':
					return {
						title: 'Delete Volumes',
						message: `Delete ${pending.ids.length} selected volume${pending.ids.length === 1 ? '' : 's'}? This cannot be undone.`,
						icon: 'trash',
						actions: [{ title: 'Delete', action: () => void bulkDeleteVolumes(pending.ids) }],
						dismissOnConfirm: false
					};
			}
		}
	);

	const selectedVolumes = volumes.filter((v) => selection.includes(v.id));
	const bulkPrimaryItem: ActionButtonItem | undefined =
		selection.length === 0
			? undefined
			: {
					id: 'bulk-delete',
					title: 'Delete',
					systemImage: 'trash',
					tint: systemColors.red,
					action: () =>
						setPendingDestructive({ kind: 'bulkDelete', ids: selectedVolumes.map((v) => v.id) })
				};

	return {
		listKey,
		allEnvironments,
		environmentID,
		snapshot,
		volumes,
		sections,
		pinnedIDs,
		size,
		searchText,
		setSearchText,
		activeFilterCount: volumesActiveFilterCount(filter),
		openFilter: () => nav.openFilter(listKey),
		loadVolumes,
		loadMore,
		refresh: () => loadVolumes(),
		openDetail: (item: VolumeItem) => nav.openDetail(item.environmentID, item.value),
		togglePin,
		togglePinAfterSwipe,
		canRename: (item: VolumeItem) => VolumeRename.isAvailable(item.value, item.environmentID),
		rename: (item: VolumeItem) => nav.openRename(item.environmentID, item.value.name, false),
		requestDelete: (item: VolumeItem) => setPendingDestructive({ kind: 'delete', volume: item }),
		createEnvironments,
		presentCreate: (envID: EnvironmentID) => nav.openCreate(envID),
		requestPrune: () => setPendingDestructive({ kind: 'prune' }),
		isOperationRunning,
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

export type VolumesListModel = ReturnType<typeof useVolumesList>;
