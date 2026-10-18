import { useFocusEffect } from 'expo-router';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore
} from 'react';

import {
	performAllEnvironmentsMaintenance,
	performAllEnvironmentsPrune
} from '@/core/all-environments-actions';
import { usePermissionCheck } from '@/core/auth/permissions';
import { BulkActionRunner, type BulkResult } from '@/core/bulk-action-runner';
import { friendlyErrorMessage } from '@/core/errors';
import { ResourcePruneAction } from '@/core/resource-prune-action';
import { nextInstanceKey, withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import type {
	ContainerResourceSample,
	ContainerSummary
} from '@/sdk/models/container/ContainerSummary';
import { Permission } from '@/sdk/models/role/Permission';
import { useAllEnvironmentsOperationStore } from '@/stores/all-environments-operation-store';
import { useClientManager } from '@/stores/client-manager';
import { ContainerResourceSampleStore } from '@/stores/container-resource-sample-store';
import { useContainerDeploymentStore } from '@/stores/container-deployment-store';
import {
	environmentItem,
	pinnedEnvironmentItemIDs,
	toggleEnvironmentItemPin,
	useEnvironmentPagedList,
	type EnvironmentFetch,
	type EnvironmentItem
} from '@/stores/environment-paged-list';
import { useEnvironmentsStore, type ListEnvironment } from '@/stores/environments-store';
import { usePinnedItemsStore } from '@/stores/pinned-items-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import {
	useAllEnvironmentsMaintenanceConfirmation,
	type AllEnvironmentsMaintenanceAction
} from '@/ui/components/all-environments-maintenance';
import {
	useItemDeleteConfirmation,
	type DeleteConfirmationConfig
} from '@/ui/components/delete-confirmation';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import {
	containersChanged,
	lightHaptic,
	performListAction,
	removeContainer
} from './container-actions';
import {
	activeFilterCount,
	bulkActionApplies,
	bulkActionInfo,
	bulkInlineActions,
	bulkPrimaryAction,
	computeContainerSections,
	containerDisplayName,
	containerHasAvailableUpdate,
	containerIsRunning,
	placeholderSummary,
	pluralContainers,
	resourceSortFor,
	type ContainerBulkAction,
	type ContainerSection,
	type ContainerStateFilter
} from './container-model';
import { useContainerNavigation } from './container-routes';
import { useContainersFilter, useContainersFilterStore } from './containers-filter-store';
import { useAppIsActive, useDebounced, useIsScreenFocused, useOnChange } from './hooks';

const pageSize = 50;

export type ContainerItem = EnvironmentItem<ContainerSummary>;

export type ContainerDestructive =
	| { kind: 'prune' }
	| { kind: 'stopAll' }
	| { kind: 'kill'; container: ContainerItem }
	| { kind: 'remove'; container: ContainerItem }
	| { kind: 'bulkRemove'; ids: string[] };

type PowerAllAction = 'startAll' | 'startStopped' | 'stopAll';

export type ContainerRowMetrics =
	| { kind: 'hidden' }
	| { kind: 'loading' }
	| { kind: 'sample'; sample: ContainerResourceSample };

const hiddenMetrics: ContainerRowMetrics = { kind: 'hidden' };
const loadingMetrics: ContainerRowMetrics = { kind: 'loading' };

export function useContainerRowMetrics(
	samples: ContainerResourceSampleStore,
	item: ContainerItem
): ContainerRowMetrics {
	const containerID = item.value.id;
	const environmentID = item.environmentID;
	const live = useSyncExternalStore(samples.subscribe, () =>
		samples.sample(containerID, environmentID)
	);
	const supported = useSyncExternalStore(samples.subscribe, () => samples.supports(environmentID));
	const pending = useSyncExternalStore(samples.subscribe, () => samples.isPending(environmentID));
	const sample = live ?? item.value.resourceSample;
	return useMemo(() => {
		if (!containerIsRunning(item.value) || !supported) return hiddenMetrics;
		if (sample) return { kind: 'sample', sample };
		return pending ? loadingMetrics : hiddenMetrics;
	}, [item.value, supported, sample, pending]);
}

const bulkTint = {
	green: systemColors.green,
	red: systemColors.red,
	orange: systemColors.orange
} as const;

async function runPowerAll(action: PowerAllAction, environmentID: EnvironmentID) {
	const current = useClientManager.getState().client;
	if (!current) return;
	try {
		const result =
			action === 'startAll'
				? await current.system.startAllContainers({ envID: environmentID })
				: action === 'startStopped'
					? await current.system.startAllStoppedContainers({ envID: environmentID })
					: await current.system.stopAllContainers({ envID: environmentID });
		containersChanged(environmentID);
		const changed = (action === 'stopAll' ? result.stopped : result.started)?.length ?? 0;
		const failed = result.failed?.length ?? 0;
		if (failed > 0) showToast(Toasts.error(`${failed} container${failed === 1 ? '' : 's'} failed`));
		else if (changed === 0)
			showToast(Toasts.info(`No containers to ${action === 'stopAll' ? 'stop' : 'start'}`));
		else
			showToast(
				Toasts.success(
					`${action === 'stopAll' ? 'Stopped' : 'Started'} ${pluralContainers(changed)}`
				)
			);
	} catch (error) {
		showToast(Toasts.error(friendlyErrorMessage(error)));
	}
}

export type ContainersListProps = {
	environmentID: EnvironmentID;
	environmentName: string;
	allEnvironments?: boolean;
	requestedStateFilter?: ContainerStateFilter;
	stateFilterRequest?: string;
};

export function useContainersList({
	environmentID,
	environmentName,
	allEnvironments = false,
	requestedStateFilter,
	stateFilterRequest
}: ContainersListProps) {
	const nav = useContainerNavigation();
	const client = useClientManager((s) => s.client);
	const accent = useAccentColor();
	const [listKey] = useState(() => nextInstanceKey('containers'));
	const filter = useContainersFilter(listKey);
	const updateFilter = useContainersFilterStore((s) => s.update);
	useEffect(() => () => useContainersFilterStore.getState().remove(listKey), [listKey]);
	useEffect(() => {
		if (requestedStateFilter) updateFilter(listKey, { stateFilter: requestedStateFilter });
	}, [listKey, requestedStateFilter, stateFilterRequest, updateFilter]);

	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);
	const debouncedLabel = useDebounced(filter.labelFilter, 500);

	const [list, snapshot] = useEnvironmentPagedList<ContainerSummary>(pageSize);
	const containers = snapshot.items;

	const [samples] = useState(() => new ContainerResourceSampleStore());

	const pinVersion = usePinnedItemsStore((s) => s.version);
	const environmentsStoreEnabled = useEnvironmentsStore((s) => s.environments);

	const [isSelecting, setIsSelecting] = useState(false);
	const [selection, setSelection] = useState<string[]>([]);
	const [isBulkRunning, setIsBulkRunning] = useState(false);
	const [bulkRunningActionID, setBulkRunningActionID] = useState<string>();
	const [pendingDestructive, setPendingDestructive] = useState<ContainerDestructive>();
	const [pendingMaintenance, setPendingMaintenance] = useState<AllEnvironmentsMaintenanceAction>();
	const isOperationRunning = useAllEnvironmentsOperationStore((s) => s.isRunning);

	useEffect(() => {
		updateFilter(listKey, { environments: snapshot.environments });
	}, [listKey, snapshot.environments, updateFilter]);

	const latest = useRef({
		debouncedSearch,
		debouncedLabel,
		showHidden: filter.showHidden,
		sort: filter.sort
	});
	useLayoutEffect(() => {
		latest.current = {
			debouncedSearch,
			debouncedLabel,
			showHidden: filter.showHidden,
			sort: filter.sort
		};
	});

	const containersPage = useCallback((): EnvironmentFetch<ContainerSummary> | undefined => {
		const current = useClientManager.getState().client;
		if (!current) return undefined;
		const { debouncedSearch: search, debouncedLabel: label, showHidden, sort } = latest.current;
		const trimmedLabel = label.trim();
		const resourceSort = resourceSortFor(sort);
		return async (envID, start, limit) => {
			const response = await current.containers.list({
				envID,
				query: {
					search: search === '' ? undefined : search,
					start,
					limit,
					sortBy: resourceSort,
					sortOrder: resourceSort === undefined ? undefined : 'desc'
				},
				includeHidden: showHidden ? true : undefined,
				label: trimmedLabel === '' ? undefined : trimmedLabel
			});
			return { items: response.data, pagination: response.pagination };
		};
	}, []);

	const loadContainers = useCallback(
		async (preservingLoadedRange = false) => {
			const fetch = containersPage();
			if (!fetch) return;
			const environments = await useEnvironmentsStore
				.getState()
				.listEnvironments(environmentID, allEnvironments);
			await list.reload(environments, fetch, { preservingLoadedRange });
		},
		[containersPage, list, environmentID, allEnvironments]
	);

	const loadMore = useCallback(async () => {
		const fetch = containersPage();
		if (fetch) await list.loadMore(fetch);
	}, [containersPage, list]);

	useFocusEffect(
		useCallback(() => {
			void loadContainers(true);
		}, [loadContainers])
	);

	const environmentIDs = snapshot.environments.map((e) => e.id).join(',');
	const mutationVersion = useResourceMutationStore((s) =>
		(allEnvironments ? snapshot.environments.map((e) => e.id) : [environmentID]).reduce(
			(total, id) => total + (s.versions[`containers::${id}`] ?? 0),
			0
		)
	);
	useOnChange(mutationVersion, () => void loadContainers(true));
	useOnChange(debouncedSearch, () => void loadContainers());
	useOnChange(filter.showHidden, () => void loadContainers());
	useOnChange(debouncedLabel, () => void loadContainers());
	useOnChange(resourceSortFor(filter.sort), () => void loadContainers(true));
	useOnChange(client, () => void loadContainers());

	const isFocused = useIsScreenFocused();
	const isActive = useAppIsActive();
	const refreshResourceSamples = useCallback(async () => {
		const current = useClientManager.getState().client;
		if (!current) return;
		await samples.refresh(
			current,
			list.getSnapshot().environments.map((e) => e.id)
		);
	}, [samples, list]);

	useEffect(() => {
		if (!isFocused || !isActive || environmentIDs === '') return;
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const tick = async () => {
			await refreshResourceSamples();
			if (!cancelled)
				timer = setTimeout(() => void tick(), ContainerResourceSampleStore.refreshIntervalMs);
		};
		void tick();
		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
		};
	}, [isFocused, isActive, environmentIDs, refreshResourceSamples]);

	const refresh = useCallback(async () => {
		await Promise.all([refreshResourceSamples(), loadContainers()]);
	}, [refreshResourceSamples, loadContainers]);

	const resourceSample = useCallback(
		(item: ContainerItem) =>
			samples.sample(item.value.id, item.environmentID) ?? item.value.resourceSample,
		[samples]
	);

	const pinnedIDs = useMemo(() => {
		void pinVersion;
		return pinnedEnvironmentItemIDs('container', containers);
	}, [containers, pinVersion]);

	const sortsByResource = resourceSortFor(filter.sort) !== undefined;
	const sortSamplesRevision = useSyncExternalStore(samples.subscribe, () =>
		sortsByResource ? samples.getRevision() : 0
	);
	const sections: ContainerSection<ContainerItem>[] = useMemo(() => {
		void sortSamplesRevision;
		return computeContainerSections(
			containers,
			{
				search: debouncedSearch,
				environmentFilter: filter.environmentFilter,
				stateFilter: filter.stateFilter,
				updateFilter: filter.updateFilter,
				showHidden: filter.showHidden,
				sort: filter.sort
			},
			pinnedIDs,
			resourceSample
		);
	}, [
		containers,
		debouncedSearch,
		filter.environmentFilter,
		filter.stateFilter,
		filter.updateFilter,
		filter.showHidden,
		filter.sort,
		pinnedIDs,
		resourceSample,
		sortSamplesRevision
	]);

	useEffect(() => {
		const valid = new Set(containers.map((c) => c.id));
		setSelection((current) => {
			const next = current.filter((id) => valid.has(id));
			return next.length === current.length ? current : next;
		});
	}, [containers]);

	const can = usePermissionCheck();
	const isRBAC = useClientManager((s) => s.serverCapabilities?.mode === 'rbac');
	const listEnvironments: ListEnvironment[] = allEnvironments
		? snapshot.environments
		: [{ id: environmentID }];
	const createEnvironments = listEnvironments.filter((e) =>
		can(Permission.Containers.create, e.id)
	);
	const canStartAll = can(Permission.Containers.start, environmentID);
	const canStopAll = can(Permission.Containers.stop, environmentID);
	const enabledEnvironments = environmentsStoreEnabled.filter((e) => e.enabled);

	const listEnvironment = useCallback(
		(id: EnvironmentID): ListEnvironment => ({
			id,
			name: allEnvironments ? (useEnvironmentsStore.getState().displayName(id) ?? id) : undefined
		}),
		[allEnvironments]
	);

	const openDetail = useCallback(
		(item: ContainerItem) => nav.openDetail(item.environmentID, item.value, item.environmentName),
		[nav]
	);
	const openLogs = useCallback(
		(item: ContainerItem) =>
			nav.openLogs(item.environmentID, item.value.id, containerDisplayName(item.value)),
		[nav]
	);
	const openTerminal = useCallback(
		(item: ContainerItem) =>
			nav.openTerminal(item.environmentID, item.value.id, containerDisplayName(item.value)),
		[nav]
	);
	const presentCreateContainer = useCallback(
		(envID: EnvironmentID) => {
			nav.openConfiguration(envID, undefined, (id) => {
				const item = environmentItem(placeholderSummary(id), listEnvironment(envID));
				nav.replaceDetail(item.environmentID, id);
				return true;
			});
		},
		[nav, listEnvironment]
	);

	const togglePin = useCallback((item: ContainerItem) => {
		lightHaptic();
		toggleEnvironmentItemPin(item, 'container');
	}, []);

	const togglePinAfterSwipe = useCallback(
		(item: ContainerItem) => setTimeout(() => togglePin(item), 250),
		[togglePin]
	);

	const startContainer = (item: ContainerItem) =>
		void performListAction('start', item.environmentID, item.value.id);
	const stopContainer = (item: ContainerItem) =>
		void performListAction('stop', item.environmentID, item.value.id);
	const restartContainer = (item: ContainerItem) =>
		void performListAction('restart', item.environmentID, item.value.id);
	const canKill = (item: ContainerItem) => can('containers:kill', item.environmentID);
	const canUpdate = (item: ContainerItem) =>
		containerHasAvailableUpdate(item.value) &&
		can(Permission.Containers.autoUpdate, item.environmentID);

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

	const startBulkUpdate = useCallback(
		(targets: ContainerItem[]) => {
			const first = targets[0];
			if (!first) return;
			const updateTargets = targets.map((t) => ({
				id: t.value.id,
				name: containerDisplayName(t.value)
			}));
			const started = useContainerDeploymentStore.getState().start({
				kind: 'containerUpdate',
				envID: first.environmentID,
				targetID: updateTargets[0]!.id,
				targetName:
					updateTargets.length === 1
						? updateTargets[0]!.name
						: `${updateTargets.length} containers`,
				environmentName: first.environmentName ?? environmentName,
				updateTargets
			});
			if (started) exitSelectionMode();
		},
		[environmentName, exitSelectionMode]
	);

	const selectedContainers = containers.filter((c) => selection.includes(c.id));
	const selectionEnvironmentID = (() => {
		const environments = new Set(selectedContainers.map((c) => c.environmentID));
		return environments.size === 1 ? [...environments][0] : undefined;
	})();

	const finishBulkOperation = async (
		result: BulkResult,
		total: number,
		environments: EnvironmentID[],
		successTitle: (count: number) => string
	) => {
		for (const environment of new Set(environments)) containersChanged(environment);
		exitSelectionMode();
		if (result.failed.length === 0) showToast(Toasts.success(successTitle(result.succeeded)));
		else showToast(Toasts.error(`${result.failed.length} of ${total} failed`));
	};

	const endBulkRun = () => {
		setIsBulkRunning(false);
		setBulkRunningActionID(undefined);
	};

	const runBulkAction = async (action: ContainerBulkAction) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		const targets = selectedContainers.filter((c) => bulkActionApplies(action, c.value));
		if (targets.length === 0) {
			showToast(Toasts.info('No matching containers selected'));
			return;
		}
		setIsBulkRunning(true);
		setBulkRunningActionID(bulkActionInfo[action].id);
		await withCleanup(async () => {
			const byID = new Map(targets.map((t) => [t.id, t]));
			const result = await BulkActionRunner.run(
				targets.map((t) => t.id),
				async (id) => {
					const container = byID.get(id);
					if (!container) return;
					const args = { envID: container.environmentID, id: container.value.id };
					if (action === 'start') await current.containers.start(args);
					else if (action === 'stop') await current.containers.stop(args);
					else await current.containers.restart(args);
				}
			);
			await finishBulkOperation(
				result,
				targets.length,
				targets.map((t) => t.environmentID),
				(count) => `${bulkActionInfo[action].summaryVerb} ${pluralContainers(count)}`
			);
		}, endBulkRun);
	};

	const bulkRemoveContainers = async (ids: string[]) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		setIsBulkRunning(true);
		setBulkRunningActionID('bulk-delete');
		await withCleanup(async () => {
			const targets = list.getSnapshot().items.filter((c) => ids.includes(c.id));
			const byID = new Map(targets.map((t) => [t.id, t]));
			const result = await BulkActionRunner.run(
				targets.map((t) => t.id),
				async (id) => {
					const container = byID.get(id);
					if (!container) return;
					await current.containers.delete({
						envID: container.environmentID,
						id: container.value.id
					});
				}
			);
			const failedIDs = new Set(result.failed.map((f) => f.id));
			const removedIDs = new Set(targets.map((t) => t.id).filter((id) => !failedIDs.has(id)));
			list.updateItems((items) => items.filter((item) => !removedIDs.has(item.id)));
			await finishBulkOperation(
				result,
				targets.length,
				targets.map((t) => t.environmentID),
				(count) => `Removed ${pluralContainers(count)}`
			);
		}, endBulkRun);
	};

	const bulkActionItem = (action: ContainerBulkAction): ActionButtonItem => {
		const info = bulkActionInfo[action];
		return {
			id: info.id,
			title: info.title,
			systemImage: info.systemImage,
			tint: bulkTint[info.tint],
			action: () => void runBulkAction(action)
		};
	};

	const primary = bulkPrimaryAction(selectedContainers);
	const bulkPrimaryItem = primary ? bulkActionItem(primary) : undefined;
	const bulkInlineItems = bulkInlineActions(selectedContainers).map(bulkActionItem);
	const bulkOverflowItems: ActionButtonItem[] = (() => {
		if (selectedContainers.length === 0) return [];
		const items: ActionButtonItem[] = [];
		const updatable = selectedContainers.filter((c) => containerHasAvailableUpdate(c.value));
		if (updatable.length > 0 && selectionEnvironmentID !== undefined) {
			items.push({
				id: 'bulk-update',
				title: `Update (${updatable.length})`,
				systemImage: 'arrow.up.circle.fill',
				tint: systemColors.blue,
				action: () => startBulkUpdate(updatable)
			});
		}
		if (
			isRBAC &&
			selectionEnvironmentID !== undefined &&
			can(Permission.Containers.read, selectionEnvironmentID)
		) {
			items.push({
				id: 'generate-compose',
				title: 'Generate Compose',
				systemImage: 'doc.text',
				tint: accent,
				action: () =>
					nav.openCompose(
						selectionEnvironmentID,
						selectedContainers.map((c) => c.value.id)
					)
			});
		}
		items.push({
			id: 'bulk-delete',
			title: 'Remove',
			systemImage: 'trash',
			tint: systemColors.red,
			action: () =>
				setPendingDestructive({ kind: 'bulkRemove', ids: selectedContainers.map((c) => c.id) })
		});
		return items;
	})();

	const pruneContainers = async () => {
		if (allEnvironments) {
			await performAllEnvironmentsPrune('containers', enabledEnvironments);
			return;
		}
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			await ResourcePruneAction.perform('containers', current, environmentID);
			containersChanged(environmentID);
			showToast(Toasts.success('Containers pruned'));
		} catch {
			showToast(Toasts.error('Prune failed'));
		}
	};

	useItemDeleteConfirmation(
		pendingDestructive,
		setPendingDestructive,
		(pending): DeleteConfirmationConfig => {
			switch (pending.kind) {
				case 'prune':
					return {
						title: 'Prune Stopped Containers',
						message: allEnvironments
							? ResourcePruneAction.allEnvironmentsMessage('containers')
							: 'Remove all stopped containers. This cannot be undone.',
						icon: 'trash',
						actions: [{ title: 'Prune', action: () => void pruneContainers() }],
						dismissOnConfirm: false
					};
				case 'stopAll':
					return {
						title: 'Stop All Containers',
						message: 'Stop every running container in this environment.',
						icon: 'stop.fill',
						actions: [
							{ title: 'Stop All', action: () => void runPowerAll('stopAll', environmentID) }
						],
						dismissOnConfirm: false
					};
				case 'kill':
					return {
						title: 'Kill Container',
						message: `Send SIGKILL to “${containerDisplayName(pending.container.value)}”? It stops immediately without a graceful shutdown.`,
						icon: 'bolt.fill',
						actions: [
							{
								title: 'Kill',
								action: () =>
									void performListAction(
										'kill',
										pending.container.environmentID,
										pending.container.value.id
									)
							}
						],
						dismissOnConfirm: false
					};
				case 'remove':
					return {
						title: 'Remove Container',
						message: `Remove “${containerDisplayName(pending.container.value)}”? This permanently deletes the container.`,
						icon: 'trash',
						actions: [
							{
								title: 'Remove',
								action: () =>
									void removeContainer(
										pending.container.environmentID,
										pending.container.value.id
									).then((removed) => {
										if (removed)
											list.updateItems((items) =>
												items.filter((item) => item.id !== pending.container.id)
											);
									})
							}
						],
						dismissOnConfirm: false
					};
				case 'bulkRemove':
					return {
						title: 'Remove Containers',
						message: `Remove ${pending.ids.length} selected container${pending.ids.length === 1 ? '' : 's'}? This cannot be undone.`,
						icon: 'trash',
						actions: [{ title: 'Remove', action: () => void bulkRemoveContainers(pending.ids) }],
						dismissOnConfirm: false
					};
			}
		}
	);

	useAllEnvironmentsMaintenanceConfirmation(pendingMaintenance, setPendingMaintenance, (action) => {
		void performAllEnvironmentsMaintenance(action, enabledEnvironments);
	});

	return {
		listKey,
		allEnvironments,
		environmentID,
		snapshot,
		containers,
		sections,
		pinnedIDs,
		samples,
		searchText,
		setSearchText,
		filter,
		activeFilterCount: activeFilterCount(filter),
		openFilter: () => nav.openFilter(listKey),
		loadContainers,
		loadMore,
		refresh,
		openDetail,
		openLogs,
		openTerminal,
		togglePin,
		togglePinAfterSwipe,
		startContainer,
		stopContainer,
		restartContainer,
		canKill,
		canUpdate,
		updateContainer: (item: ContainerItem) => startBulkUpdate([item]),
		requestKill: (item: ContainerItem) => setPendingDestructive({ kind: 'kill', container: item }),
		requestRemove: (item: ContainerItem) =>
			setPendingDestructive({ kind: 'remove', container: item }),
		createEnvironments,
		presentCreateContainer,
		canStartAll,
		canStopAll,
		startAll: () => void runPowerAll('startAll', environmentID),
		startStopped: () => void runPowerAll('startStopped', environmentID),
		requestStopAll: () => setPendingDestructive({ kind: 'stopAll' }),
		requestPrune: () => setPendingDestructive({ kind: 'prune' }),
		isOperationRunning,
		selectMaintenance: setPendingMaintenance,
		isSelecting,
		selection,
		enterSelectionMode,
		exitSelectionMode,
		toggleSelected,
		bulkToolbar: {
			primary: bulkPrimaryItem,
			secondary: bulkInlineItems,
			overflow: bulkOverflowItems,
			runningItemID: bulkRunningActionID,
			isDisabled: isBulkRunning,
			resourceName: `${selection.length} selected`,
			active: isSelecting && selection.length > 0
		}
	};
}

export type ContainersListModel = ReturnType<typeof useContainersList>;
