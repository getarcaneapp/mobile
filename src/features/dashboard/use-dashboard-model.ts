import { useFocusEffect, useNavigation, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useStore } from 'zustand';

import '@/stores/environment-detail-streams';

import { AppTabIDs, type AppTab } from '@/core/app-tab';
import { hasPermission } from '@/core/auth/permissions';
import { Permission } from '@/sdk/models/role/Permission';
import { User } from '@/sdk/models/user/User';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { ProjectDetails } from '@/sdk/models/project/Project';
import { useActivityHistoryMutationStore } from '@/stores/activity-history-mutation-store';
import { useClientManager } from '@/stores/client-manager';
import { useDashboardStreamStore } from '@/stores/dashboard-stream-store';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { useImageUpdateCountStore } from '@/stores/image-update-count-store';
import { resolveTabs, useNavTabsStore } from '@/stores/nav-tabs-store';
import { usePinnedItemsStore } from '@/stores/pinned-items-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { maxStatsStreams } from '@/stores/system-stats-history-store';

import type { PickerEnvironment } from '@/ui/components/environment-context.types';

import {
	countAvailabilityIssues,
	displayName,
	liveStatsLimitMessage,
	needsAttentionItems,
	reappearRefreshIntervalMs,
	type AttentionAction,
	type DashboardTotalsTile,
	type NeedsAttentionItem
} from './dashboard-logic';
import { createDashboardViewStore } from './dashboard-view-store';

let nextConsumerID = 0;

export function useDashboardModel() {
	const router = useRouter();
	const navigation = useNavigation();
	const segments = useSegments() as string[];
	const group = segments[1] ?? '(dashboard)';

	const unmountedRef = useRef(false);
	const [store] = useState(() => createDashboardViewStore(() => unmountedRef.current));
	const view = useStore(store);

	const client = useClientManager((s) => s.client);
	const currentUser = useClientManager((s) => s.currentUser);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const allEnvironmentsPreview = useClientManager((s) => s.allEnvironmentsPreview);
	const refreshedDashboardPreview = useClientManager((s) => s.refreshedDashboardPreview);
	const serverCapabilities = useClientManager((s) => s.serverCapabilities);
	const supportsActivities = serverCapabilities?.mode === 'rbac';
	useClientManager((s) => s.accessGeneration);

	const catalogRevision = useEnvironmentsStore((s) => s.environmentCatalogRevision);
	const dockerRevision = useEnvironmentsStore((s) => s.dockerInformationRevision);
	const dockerInfoByEnvironmentID = useEnvironmentsStore((s) => s.dockerInfoByEnvironmentID);

	const aggregate = useDashboardStreamStore((s) => s.aggregate);
	const attention = useDashboardStreamStore((s) => s.attention);
	const streamFailed = useDashboardStreamStore((s) => s.streamFailed);
	const streamUnsupported = useDashboardStreamStore((s) => s.streamUnsupported);
	useImageUpdateCountStore((s) => s.counts);
	const latestClear = useActivityHistoryMutationStore((s) => s.latestClear);
	const mutationVersions = useResourceMutationStore((s) => s.versions);
	usePinnedItemsStore((s) => s.version);

	const [consumerID] = useState(() => `dashboard-${nextConsumerID++}`);
	const holdsStreamsRef = useRef(false);
	const isVisibleRef = useRef(false);
	const wasBackgroundedRef = useRef(false);

	const [showAttentionSummary, setShowAttentionSummary] = useState(false);
	const [showAttentionCenter, setShowAttentionCenter] = useState(false);
	const pendingAttentionAction = useRef<(() => void) | undefined>(undefined);
	const [showPruneSheet, setShowPruneSheet] = useState(false);
	const [showEnvironmentPicker, setShowEnvironmentPicker] = useState(false);
	const [showCountAvailability, setShowCountAvailability] = useState(false);
	const [isUpdateAllArmed, setUpdateAllArmed] = useState(false);
	const disarmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const acquireStreams = useCallback(() => {
		holdsStreamsRef.current = true;
		useEnvironmentsStore
			.getState()
			.setVisible(true, consumerID, useClientManager.getState().supportsActivities());
	}, [consumerID]);

	const releaseStreams = useCallback(() => {
		if (!holdsStreamsRef.current) return;
		holdsStreamsRef.current = false;
		useEnvironmentsStore
			.getState()
			.setVisible(false, consumerID, useClientManager.getState().supportsActivities());
	}, [consumerID]);

	useEffect(() => {
		unmountedRef.current = false;
		return () => {
			unmountedRef.current = true;
			if (holdsStreamsRef.current) {
				holdsStreamsRef.current = false;
				useEnvironmentsStore.getState().setVisible(false, consumerID, false);
			}
		};
	}, [consumerID]);

	useEffect(() => {
		useEnvironmentsStore.getState().configure(client);
	}, [client]);

	useFocusEffect(
		useCallback(() => {
			isVisibleRef.current = true;
			if (AppState.currentState !== 'background') acquireStreams();
			const state = store.getState();
			if (!state.hasLoadedOnce) {
				void state.loadData();
			} else if (
				state.needsRefreshOnAppear ||
				state.lastRefreshAt === undefined ||
				Date.now() - state.lastRefreshAt > reappearRefreshIntervalMs
			) {
				void state.refreshDashboard(false);
			}
			return () => {
				isVisibleRef.current = false;
			};
		}, [acquireStreams, store])
	);

	useEffect(() => {
		const tabStack = navigation.getParent();
		if (!tabStack) return;
		const unsubscribe = tabStack.addListener('blur', () => releaseStreams());
		const focus = tabStack.addListener('focus', () => {
			if (isVisibleRef.current && AppState.currentState !== 'background') acquireStreams();
		});
		const stateListener = navigation.addListener('blur', () => {
			if (!tabStack.isFocused()) releaseStreams();
		});
		return () => {
			unsubscribe();
			focus();
			stateListener();
		};
	}, [navigation, acquireStreams, releaseStreams]);

	useEffect(() => {
		const subscription = AppState.addEventListener('change', (phase) => {
			if (phase === 'background') {
				const resumes = holdsStreamsRef.current;
				releaseStreams();
				wasBackgroundedRef.current = resumes || isVisibleRef.current;
			} else if (phase === 'active') {
				if (!wasBackgroundedRef.current) return;
				wasBackgroundedRef.current = false;
				if (!isVisibleRef.current) {
					store.setState({ needsRefreshOnAppear: true });
					return;
				}
				acquireStreams();
				if (store.getState().hasLoadedOnce) void store.getState().refreshDashboard(false);
				else store.setState({ needsRefreshOnAppear: true });
			}
		});
		return () => subscription.remove();
	}, [acquireStreams, releaseStreams, store]);

	useEffect(() => {
		if (supportsActivities && holdsStreamsRef.current) {
			useEnvironmentsStore.getState().setVisible(true, consumerID, true);
		}
	}, [supportsActivities, consumerID]);

	const firstActive = useRef(true);
	useEffect(() => {
		if (firstActive.current) {
			firstActive.current = false;
			return;
		}
		store.getState().reorderForActiveEnvironment();
	}, [activeEnvironmentID, store]);

	useEffect(() => {
		store.getState().updateEnvironmentCatalogFromStore();
	}, [catalogRevision, store]);

	useEffect(() => {
		store.getState().updateLiveStateFromStore();
	}, [dockerRevision, store]);

	const previousAggregate = useRef(aggregate);
	useEffect(() => {
		const previous = previousAggregate.current;
		previousAggregate.current = aggregate;
		if (!previous || !aggregate || previous === aggregate) return;
		const containersChanged =
			previous.runningContainers !== aggregate.runningContainers ||
			previous.stoppedContainers !== aggregate.stoppedContainers ||
			previous.totalContainers !== aggregate.totalContainers ||
			previous.totalImages !== aggregate.totalImages;
		if (containersChanged) void store.getState().refreshLiveCounts();
	}, [aggregate, store]);

	useEffect(() => {
		if (latestClear) store.getState().applyHistoryClear();
	}, [latestClear, store]);

	const firstMutation = useRef(true);
	useEffect(() => {
		if (firstMutation.current) {
			firstMutation.current = false;
			return;
		}
		if (!store.getState().hasLoadedOnce) return;
		if (!isVisibleRef.current) {
			store.setState({ needsRefreshOnAppear: true });
			return;
		}
		const timer = setTimeout(() => void store.getState().refreshDashboard(false), 800);
		return () => clearTimeout(timer);
	}, [mutationVersions, store]);

	useEffect(() => () => clearTimeout(disarmTimer.current), []);

	const enabledEnvironments = useMemo(
		() => view.allEnvironments.filter((e) => e.enabled),
		[view.allEnvironments]
	);
	const imageUpdatesTotal = view.imageUpdatesTotal();
	const isAdmin = currentUser ? User.isAdmin(currentUser) : false;
	const canPrune = allEnvironmentsPreview
		? enabledEnvironments.some((e) => hasPermission(Permission.System.prune, e.id))
		: hasPermission(Permission.System.prune, activeEnvironmentID);

	const pinnedStore = usePinnedItemsStore.getState();
	const hasPinnedDashboardResources =
		pinnedStore.pinnedIDs('container', activeEnvironmentID).size > 0 ||
		pinnedStore.pinnedIDs('project', activeEnvironmentID).size > 0;

	const showsSkeleton = !view.hasLoadedOnce && view.isLoading;
	const showsEmptyState =
		!showsSkeleton && view.environments.length === 0 && view.hasLoadedEnvironments;

	const attentionItems = needsAttentionItems({
		attention,
		allEnvironments: view.allEnvironments,
		allEnvironmentsPreview,
		imageUpdatesTotal,
		failedActivityCount: view.failedActivities.length
	});

	const countIssues = countAvailabilityIssues({
		hasLoadedEnvironmentCounts: view.hasLoadedEnvironmentCounts,
		allEnvironments: view.allEnvironments,
		liveStates: view.environmentLiveStates,
		liveCounts: view.liveCounts,
		volumeCountUnavailableEnvironmentIDs: view.volumeCountUnavailableEnvironmentIDs,
		updateCountUnavailableEnvironmentIDs: view.updateCountUnavailableEnvironmentIDs,
		hasStreamAggregate: aggregate !== undefined
	});

	const liveStatsMessage = liveStatsLimitMessage(enabledEnvironments.length, maxStatsStreams());
	const showsStreamFailedBanner = streamFailed && !streamUnsupported;

	const pinned = useNavTabsStore((s) => s.pinnedTabs);
	const canAccess = useClientManager((s) => s.canAccess);
	const visibleTabs = useMemo(
		() => new Set<AppTab>(resolveTabs(pinned, new Set(AppTabIDs.filter(canAccess)))),
		[pinned, canAccess]
	);

	const selectTab = (tab: AppTab) => {
		if (visibleTabs.has(tab)) router.navigate(`/(tabs)/(${tab})/${tab}` as never);
		else router.push(`/(tabs)/${group}/${tab}` as never);
	};

	const push = (path: string, params?: Record<string, string>) =>
		router.push({ pathname: `/(tabs)/${group}/${path}` as never, params });

	const openEnvironment = (environment: Pick<Environment, 'id' | 'name'>) =>
		push('environment/[id]', { id: environment.id, name: environment.name ?? environment.id });
	const openContainer = (container: ContainerSummary, environmentID: string) =>
		push('container/[id]', { id: container.id, envID: environmentID });
	const openProject = (project: ProjectDetails) =>
		push('project/[id]', { id: project.id, envID: activeEnvironmentID, name: project.name });
	const openVulnerabilities = (environmentID: string) =>
		push('imageVulnerabilities', { envID: environmentID });
	const openVolumes = () => push('volumes');
	const openImageUpdates = () => push('image-updates-sheet');
	const openActivityCenter = () => push('activity-center');
	const openAPIKeys = () => push('apiKeys');
	const openUpdateAll = () =>
		push('update-all-environments', { count: String(view.rawEnvironmentCount) });

	const openTile = (tile: DashboardTotalsTile) => {
		switch (tile) {
			case 'running':
			case 'stopped':
				return selectTab('containers');
			case 'images':
				return selectTab('images');
			case 'volumes':
				return openVolumes();
			case 'updates':
				return openImageUpdates();
			case 'vulnerabilities':
				return openVulnerabilities(attention.mostVulnerableEnvironmentID ?? activeEnvironmentID);
			default:
				return;
		}
	};

	const runAttentionAction = (action: AttentionAction) => {
		switch (action.kind) {
			case 'environment':
				return openEnvironment({ id: action.id, name: action.name });
			case 'vulnerabilities':
				return openVulnerabilities(action.id);
			case 'containersTab':
				return selectTab('containers');
			case 'imageUpdates':
				return openImageUpdates();
			case 'apiKeys':
				return openAPIKeys();
			case 'activityCenter':
				return openActivityCenter();
		}
	};

	const performAttention = (item: NeedsAttentionItem) => {
		setShowAttentionSummary(false);
		const action = () => runAttentionAction(item.action);
		if (showAttentionCenter) {
			pendingAttentionAction.current = action;
			setShowAttentionCenter(false);
		} else if (item.presentsSheet) {
			setTimeout(action, 250);
		} else {
			action();
		}
	};

	const openAttentionCenter = () => {
		setShowAttentionSummary(false);
		setTimeout(() => setShowAttentionCenter(true), 250);
	};

	const attentionCenterDismissed = () => {
		setShowAttentionCenter(false);
		const action = pendingAttentionAction.current;
		pendingAttentionAction.current = undefined;
		action?.();
	};

	const disarmUpdateAll = () => {
		clearTimeout(disarmTimer.current);
		disarmTimer.current = undefined;
		setUpdateAllArmed(false);
	};

	const pressUpdateAll = () => {
		if (isUpdateAllArmed) {
			disarmUpdateAll();
			openUpdateAll();
			return;
		}
		setUpdateAllArmed(true);
		clearTimeout(disarmTimer.current);
		disarmTimer.current = setTimeout(() => setUpdateAllArmed(false), 4000);
	};

	const activeEnvironmentName = useClientManager((s) => s.activeEnvironmentName);
	const pickerEnvironments: PickerEnvironment[] = view.allEnvironments.map((e) => ({
		id: e.id,
		displayName: displayName(e),
		apiUrl: e.apiUrl,
		status: e.status,
		enabled: e.enabled
	}));
	const selectEnvironment = (environment: PickerEnvironment) => {
		setShowEnvironmentPicker(false);
		useClientManager.getState().setActiveEnvironment(environment.id, environment.displayName);
	};

	return {
		store,
		activeEnvironmentName,
		pickerEnvironments,
		selectEnvironment,
		view,
		client,
		currentUser,
		activeEnvironmentID,
		allEnvironmentsPreview,
		refreshedDashboardPreview,
		supportsActivities,
		isAdmin,
		canPrune,
		enabledEnvironments,
		dockerInfoByEnvironmentID,
		imageUpdatesTotal,
		attention,
		attentionItems,
		countIssues,
		liveStatsMessage,
		showsStreamFailedBanner,
		showsSkeleton,
		showsEmptyState,
		hasPinnedDashboardResources,
		arcaneUpgradeCount: attention.arcaneUpgradeCount,
		isUpdateAllArmed,
		pressUpdateAll,
		disarmUpdateAll,

		showAttentionSummary,
		setShowAttentionSummary,
		showAttentionCenter,
		setShowAttentionCenter,
		openAttentionCenter,
		attentionCenterDismissed,
		performAttention,
		showPruneSheet,
		setShowPruneSheet,
		showEnvironmentPicker,
		setShowEnvironmentPicker,
		showCountAvailability,
		setShowCountAvailability,

		refresh: () => store.getState().refreshDashboard(),
		retryStream: () => useDashboardStreamStore.getState().retry(),
		showNextEnvironmentBatch: () => store.getState().showNextEnvironmentBatch(),
		refreshEnvironmentDockerInfo: (id: string) => store.getState().refreshEnvironmentDockerInfo(id),

		selectTab,
		openEnvironment,
		openContainer,
		openProject,
		openTile,
		openActivityCenter,
		openSystemUpgrade: (environmentID: string) => push('system-upgrade', { envID: environmentID }),
		openPrune: (environmentID?: string) =>
			router.push({
				pathname: `/(tabs)/${group}/system-prune` as never,
				params: environmentID
					? { envID: environmentID }
					: allEnvironmentsPreview
						? { all: '1', envID: activeEnvironmentID }
						: { envID: activeEnvironmentID }
			}),
		openEnvironmentColor: (environment: Environment) =>
			push('environment-color', { id: environment.id, name: environment.name ?? environment.id })
	};
}

export type DashboardModel = ReturnType<typeof useDashboardModel>;
