import * as Haptics from 'expo-haptics';
import { useShallow } from 'zustand/react/shallow';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { Activity, ActivityMessage } from '@/sdk/models/activity/Activity';
import { User } from '@/sdk/models/user/User';
import {
	createActivityCenterStore,
	useActivityCenter,
	type ActivityCenterState,
	type ActivityCenterStore
} from '@/stores/activity-center-store';
import { useActivityHistoryMutationStore } from '@/stores/activity-history-mutation-store';
import { useClientManager } from '@/stores/client-manager';
import { singleActionConfig, useDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import {
	ActivityDisplay,
	activityCountHeader,
	type ActivityStatusFilter
} from './activity-display';
import { useActivityNavigation } from './activity-routes';

function useIsNotBackground(): boolean {
	const [notBackground, setNotBackground] = useState(AppState.currentState !== 'background');
	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) =>
			setNotBackground(state !== 'background')
		);
		return () => subscription.remove();
	}, []);
	return notBackground;
}

function useDebouncedEffect<T>(value: T, delayMs: number, apply: (value: T) => void) {
	const onApply = useEffectEvent(apply);
	useEffect(() => {
		const timer = setTimeout(() => onApply(value), delayMs);
		return () => clearTimeout(timer);
	}, [value, delayMs]);
}

const transportIDs = new WeakMap<object, number>();
let nextTransportID = 1;
function transportKey(transport: object | undefined): number {
	if (!transport) return 0;
	let id = transportIDs.get(transport);
	if (id === undefined) {
		id = nextTransportID++;
		transportIDs.set(transport, id);
	}
	return id;
}

function useActivitySession() {
	const client = useClientManager((s) => s.client);
	const supportsActivities = useClientManager((s) => s.serverCapabilities?.mode === 'rbac');
	const currentUser = useClientManager((s) => s.currentUser);
	useClientManager((s) => s.accessGeneration);
	const notBackground = useIsNotBackground();
	const taskID = `${supportsActivities}-${transportKey(client?.transport)}-${notBackground}`;
	return { client, supportsActivities, currentUser, notBackground, taskID };
}

function withoutActivityDetails({
	activityDetails: _activityDetails,
	...rest
}: ActivityCenterState): Omit<ActivityCenterState, 'activityDetails'> {
	return rest;
}

function createFilteredActivityCenterStore(statusFilter: ActivityStatusFilter | undefined) {
	const store = createActivityCenterStore();
	if (statusFilter) store.getState().setStatusFilter(statusFilter);
	return store;
}

export function useActivitiesScreen(initialStatusFilter?: ActivityStatusFilter) {
	const [store] = useState(() => createFilteredActivityCenterStore(initialStatusFilter));
	const { client, supportsActivities, currentUser, notBackground, taskID } = useActivitySession();
	const recordClear = useActivityHistoryMutationStore((s) => s.recordClear);
	const navigation = useActivityNavigation();

	const state = useActivityCenter(store, useShallow(withoutActivityDetails));
	const [searchText, setSearchText] = useState('');
	const [showClearConfirm, setShowClearConfirm] = useState(false);
	const [expandedBatchIDs, setExpandedBatchIDs] = useState<ReadonlySet<string>>(new Set());
	const loadedTaskID = useRef<string | undefined>(undefined);

	useDebouncedEffect(searchText, 250, (value) => store.getState().setSearchText(value));

	useFocusEffect(
		useCallback(() => {
			store.getState().acquireStream();
			return () => store.getState().releaseStream();
		}, [store])
	);

	const currentClient = useEffectEvent(() => client);
	useEffect(() => {
		const actions = store.getState();
		actions.configure(supportsActivities ? currentClient() : undefined);
		if (!supportsActivities || !notBackground) {
			loadedTaskID.current = undefined;
			actions.stopStream();
			return;
		}
		if (loadedTaskID.current === taskID) return;
		loadedTaskID.current = taskID;
		void actions.retryLiveUpdates();
	}, [taskID, supportsActivities, notBackground, store]);

	useEffect(() => () => store.getState().stopStream(), [store]);

	const clearableEnvironmentIDs: ReadonlySet<string> = new Set(
		currentUser
			? state.environmentIDs.filter((id) =>
					User.hasPermission(currentUser, 'activities:delete', id)
				)
			: []
	);
	const canClearHistory = clearableEnvironmentIDs.size > 0;

	useDeleteConfirmation(
		showClearConfirm,
		setShowClearConfirm,
		singleActionConfig({
			title: 'Clear Activity History?',
			message: 'Running and queued activities are preserved.',
			icon: 'trash',
			confirmTitle: 'Clear History',
			onConfirm: () => {
				void (async () => {
					const result = await store.getState().clearHistory(clearableEnvironmentIDs);
					if (!result) return;
					recordClear(result.clearedEnvironmentIDs);
					let message = `Cleared ${result.deleted} completed activit${result.deleted === 1 ? 'y' : 'ies'}.`;
					if (result.failed > 0) {
						message += ` ${result.failed} environment${result.failed === 1 ? '' : 's'} could not be cleared.`;
					}
					showToast(Toasts.success(message));
					await store.getState().load({ refresh: true });
				})();
			}
		})
	);

	const activeFilterCount =
		(state.statusFilter === 'all' ? 0 : 1) +
		(state.typeFilter !== '' ? 1 : 0) +
		(state.resourceFilter !== '' ? 1 : 0);

	const countHeader = activityCountHeader({
		shownCount: state.runningItems.length + state.historyItems.length,
		activityCount: state.filteredActivityCount,
		hasMore: state.hasMore,
		isFiltering: activeFilterCount > 0 || state.searchText.trim() !== ''
	});

	const loadMore = useCallback(() => {
		const { isLoading, isLoadingMore } = store.getState();
		if (isLoading || isLoadingMore) return;
		void store.getState().loadMore();
	}, [store]);

	return {
		store,
		state,
		supportsActivities,
		searchText,
		setSearchText,
		canClearHistory,
		activeFilterCount,
		countHeader,
		requestClear: () => setShowClearConfirm(true),
		retry: () => store.getState().retryLiveUpdates(),
		loadMore,
		retryLoadMore: () => void store.getState().loadMore(),
		clearFilters: () => {
			const actions = store.getState();
			actions.setStatusFilter('all');
			actions.setTypeFilter('');
			actions.setResourceFilter('');
		},
		isExpanded: (batchID: string) => expandedBatchIDs.has(batchID),
		setExpanded: (batchID: string, expanded: boolean) =>
			setExpandedBatchIDs((current) => {
				const next = new Set(current);
				if (expanded) next.add(batchID);
				else next.delete(batchID);
				return next;
			}),
		openActivity: (activity: Activity) => navigation.openActivity(activity, store)
	};
}

export type ActivitiesScreenModel = ReturnType<typeof useActivitiesScreen>;

const hasClient = () => useClientManager.getState().client !== undefined;

function cancelRequester(): string | undefined | null {
	const manager = useClientManager.getState();
	if (!manager.client) return null;
	return manager.currentUser?.displayName ?? manager.currentUser?.username;
}

export function useActivityDetail(
	initialActivity: Activity,
	sharedStore: ActivityCenterStore | undefined
) {
	const [ownStore] = useState(createActivityCenterStore);
	const store = sharedStore ?? ownStore;
	const isShared = sharedStore !== undefined;
	const { client, supportsActivities, currentUser, notBackground, taskID } = useActivitySession();

	const detail = useActivityCenter(store, (s) => s.detail(initialActivity));
	const streamErrorMessage = useActivityCenter(store, (s) => s.streamErrorMessage);
	const activity = detail?.activity ?? initialActivity;
	const messages: ActivityMessage[] = detail?.messages ?? [];

	const [isLoading, setIsLoading] = useState(false);
	const [isCancelling, setIsCancelling] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
	const [showCancelConfirm, setShowCancelConfirm] = useState(false);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const environmentID = ActivityDisplay.sourceEnvironmentKey(activity);
	const canCancel =
		ActivityDisplay.isCancellable(activity) &&
		(currentUser ? User.hasPermission(currentUser, 'activities:cancel', environmentID) : false);

	const loadDetail = useCallback(async () => {
		if (!hasClient()) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		await withCleanup(
			() =>
				store
					.getState()
					.loadDetail(initialActivity)
					.catch((error: unknown) => {
						if (mounted.current) setErrorMessage(friendlyErrorMessage(error));
					}),
			() => {
				if (mounted.current) setIsLoading(false);
			}
		);
	}, [store, initialActivity]);

	const currentClient = useEffectEvent(() => client);
	const loadLatest = useEffectEvent(() => loadDetail());
	useEffect(() => {
		const actions = store.getState();
		if (!isShared) actions.configure(supportsActivities ? currentClient() : undefined);
		if (!supportsActivities || !notBackground) {
			if (!isShared) actions.stopStream();
			return;
		}
		if (!isShared) actions.startStream();
		void loadLatest();
	}, [taskID, supportsActivities, notBackground, store, isShared]);

	useFocusEffect(
		useCallback(() => {
			sharedStore?.getState().acquireStream();
			return () => {
				if (sharedStore) sharedStore.getState().releaseStream();
				else ownStore.getState().stopStream();
			};
		}, [sharedStore, ownStore])
	);

	const cancelActivity = async () => {
		const requestedBy = cancelRequester();
		if (requestedBy === null) return;
		setIsCancelling(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				if (await store.getState().cancel(activity, requestedBy)) {
					void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
				} else if (mounted.current) {
					setErrorMessage(store.getState().errorMessage);
				}
			},
			() => {
				if (mounted.current) setIsCancelling(false);
			}
		);
	};

	useDeleteConfirmation(showCancelConfirm, setShowCancelConfirm, {
		title: 'Cancel Activity?',
		message: 'Arcane will request cancellation. Work that already finished cannot be undone.',
		icon: 'xmark.circle',
		actions: [{ title: 'Cancel Activity', action: () => void cancelActivity() }],
		cancelTitle: 'Keep Running'
	});

	return {
		activity,
		messages,
		streamErrorMessage,
		isLoading,
		isCancelling,
		errorMessage,
		dismissError: () => setErrorMessage(undefined),
		canCancel,
		requestCancel: () => setShowCancelConfirm(true),
		retryStream: () => {
			store.getState().startStream();
			void loadDetail();
		},
		refresh: async () => {
			if (!isShared) store.getState().startStream();
			await loadDetail();
		}
	};
}

export type ActivityDetailModel = ReturnType<typeof useActivityDetail>;
