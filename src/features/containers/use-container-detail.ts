/**
 * The platform-neutral model behind ContainerDetailView.swift: inspect
 * loading, lifecycle actions, auto-update, rename, logs download, the
 * Overview metadata, and the resource-actions toolbar items.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ContainerDetails } from '@/sdk/models/container/ContainerDetails';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { useContainerDeploymentStore } from '@/stores/container-deployment-store';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { useResourceVersion } from '@/stores/resource-mutation-store';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import type { ResourceMetadataItem } from '@/ui/components/resource-detail.types';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import {
	containersChanged,
	lifecycleSuccessTitle,
	runLifecycle,
	type ContainerLifecycleAction
} from './container-actions';
import { boundedContainerInspectWithAutoUpdate } from './container-inspect';
import {
	capitalized,
	containerDisplayName,
	containerIsRunning,
	containerStatusText,
	placeholderSummary,
	themedIconUrl,
	trimSlashes
} from './container-model';
import { containerCache, useContainerNavigation } from './container-routes';
import { downloadAndShare } from './share-file';

export type DetailTab = 'overview' | 'stats' | 'logs' | 'processes';

export const detailTabs: { value: DetailTab; title: string; systemImage: string; tint: string }[] =
	[
		{
			value: 'overview',
			title: 'Overview',
			systemImage: 'info.circle.fill',
			tint: systemColors.purple
		},
		{ value: 'stats', title: 'Stats', systemImage: 'chart.xyaxis.line', tint: systemColors.blue },
		{ value: 'logs', title: 'Logs', systemImage: 'text.alignleft', tint: systemColors.teal },
		{
			value: 'processes',
			title: 'Processes',
			systemImage: 'list.number',
			tint: systemColors.orange
		}
	];

const nonEmpty = (value?: string) => (value ? value : undefined);

export function useContainerDetail(environmentID: EnvironmentID, initialID: string) {
	const nav = useContainerNavigation();
	const accent = useAccentColor();
	const [container, setContainer] = useState<ContainerSummary>(
		() => containerCache.summary(environmentID, initialID) ?? placeholderSummary(initialID)
	);
	const [details, setDetails] = useState<ContainerDetails | undefined>(() =>
		containerCache.details(environmentID, initialID)
	);
	const [isLoading, setIsLoading] = useState(false);
	const [isActioning, setIsActioning] = useState(false);
	const [runningActionID, setRunningActionID] = useState<string>();
	const [selectedTab, setSelectedTab] = useState<DetailTab>('overview');
	const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean>();
	const [isSavingAutoUpdate, setIsSavingAutoUpdate] = useState(false);
	useClientManager((s) => s.accessGeneration);
	const isRBAC = useClientManager((s) => s.serverCapabilities?.mode === 'rbac');

	const containerRef = useRef(container);
	containerRef.current = container;

	const showError = (error: unknown) =>
		Alert.alert('Error', friendlyErrorMessage(error), [{ text: 'OK' }]);

	const loadDetails = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const requestedID = containerRef.current.id;
		const generation = useClientManager.getState().clientGeneration;
		setIsLoading(true);
		try {
			const loaded = await boundedContainerInspectWithAutoUpdate(
				client,
				environmentID,
				requestedID
			);
			if (
				requestedID !== containerRef.current.id ||
				generation !== useClientManager.getState().clientGeneration
			)
				return;
			containerCache.setDetails(environmentID, loaded.details);
			setDetails(loaded.details);
			setAutoUpdateEnabled(loaded.autoUpdateEnabled);
		} catch {
			// Ignore inspect errors — show what we have.
		} finally {
			setIsLoading(false);
		}
	}, [environmentID]);

	useFocusEffect(
		useCallback(() => {
			void loadDetails();
		}, [loadDetails])
	);
	const mutationVersion = useResourceVersion('containers', environmentID);
	const firstVersion = useRef(mutationVersion);
	useEffect(() => {
		if (firstVersion.current === mutationVersion) return;
		firstVersion.current = mutationVersion;
		void loadDetails();
	}, [mutationVersion, loadDetails]);

	// MARK: Derived state

	const statusString = details?.state.status ?? container.status;
	const isRunning = details?.state.running ?? containerIsRunning(container);
	const isPaused = statusString.toLowerCase() === 'paused';
	const displayedName = (() => {
		const trimmed = trimSlashes(details?.name ?? '');
		return trimmed !== '' ? trimmed : containerDisplayName(container);
	})();
	const headerIconUrl = (isDark: boolean) =>
		(details ? themedIconUrl(details, isDark) : undefined) ?? themedIconUrl(container, isDark);
	const availableTabs = detailTabs.filter(
		(tab) => tab.value !== 'processes' || (isRunning && !isPaused)
	);
	useEffect(() => {
		if (!availableTabs.some((tab) => tab.value === selectedTab)) setSelectedTab('overview');
	}, [availableTabs, selectedTab]);

	const statusIndicatorColor =
		statusString.toLowerCase() === 'running'
			? systemColors.green
			: statusString.toLowerCase() === 'paused'
				? systemColors.orange
				: undefined;

	const environmentName =
		useEnvironmentsStore((s) => s.displayName(environmentID)) ??
		useClientManager.getState().activeEnvironmentName;

	// MARK: Actions

	const performAction = async (action: ContainerLifecycleAction, actionID?: string) => {
		if (!useClientManager.getState().client) return;
		setIsActioning(true);
		setRunningActionID(actionID);
		try {
			await runLifecycle(action, environmentID, container.id);
			containersChanged(environmentID);
			await loadDetails();
			showToast(Toasts.success(lifecycleSuccessTitle[action]));
		} catch (error) {
			showError(error);
		} finally {
			setIsActioning(false);
			setRunningActionID(undefined);
		}
	};

	const deleteContainer = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsActioning(true);
		try {
			await client.rest.deleteVoid(
				client.rest.environmentPath(environmentID, `containers/${container.id}`)
			);
			containersChanged(environmentID);
			showToast(Toasts.success('Container removed'));
			// The confirmation card already dismissed this screen.
		} catch (error) {
			showError(error);
		} finally {
			setIsActioning(false);
		}
	};

	const downloadLogs = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			const request = await client.containers.downloadLogsDownloadRequest({
				envID: environmentID,
				id: container.id
			});
			await downloadAndShare(request, `container-${container.id.slice(0, 12)}-logs.log`);
		} catch (error) {
			showError(error);
		}
	};

	const setAutoUpdate = async (enabled: boolean) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const previous = autoUpdateEnabled;
		setAutoUpdateEnabled(enabled);
		setIsSavingAutoUpdate(true);
		try {
			await client.containers.setAutoUpdate({ envID: environmentID, id: container.id, enabled });
			containersChanged(environmentID);
			showToast(Toasts.success(enabled ? 'Auto-update enabled' : 'Auto-update disabled'));
		} catch (error) {
			setAutoUpdateEnabled(previous);
			showError(error);
		} finally {
			setIsSavingAutoUpdate(false);
		}
	};

	const startDeployment = (kind: 'containerRedeploy' | 'containerUpdate') =>
		useContainerDeploymentStore.getState().start({
			kind,
			envID: environmentID,
			targetID: container.id,
			targetName: displayedName,
			environmentName,
			updateTargets: kind === 'containerUpdate' ? [{ id: container.id, name: displayedName }] : []
		});

	/** ContainerConfigurationView `onSaved`: the edit recreated the container with a new ID. */
	const openEdit = () =>
		nav.openConfiguration(environmentID, container.id, (id) => {
			setContainer(placeholderSummary(id));
			setDetails(undefined);
			setSelectedTab('overview');
			containerRef.current = placeholderSummary(id);
			void loadDetails();
		});

	// MARK: Toolbar items

	const actionPrimary: ActionButtonItem = isPaused
		? {
				id: 'unpause',
				title: 'Unpause',
				systemImage: 'play.fill',
				tint: systemColors.green,
				action: () => void performAction('unpause', 'unpause')
			}
		: isRunning
			? {
					id: 'stop',
					title: 'Stop',
					systemImage: 'stop.fill',
					tint: systemColors.red,
					role: 'destructive',
					action: () => void performAction('stop', 'stop')
				}
			: {
					id: 'start',
					title: 'Start',
					systemImage: 'play.fill',
					tint: systemColors.green,
					action: () => void performAction('start', 'start')
				};

	const actionSecondary: ActionButtonItem[] = [
		...(container.updateInfo?.hasUpdate === true &&
		hasPermission(Permission.Containers.autoUpdate, environmentID)
			? [
					{
						id: 'update',
						title: 'Update',
						systemImage: 'arrow.up.circle.fill',
						tint: systemColors.blue,
						action: () => startDeployment('containerUpdate')
					}
				]
			: []),
		...(isRunning && !isPaused
			? [
					{
						id: 'restart',
						title: 'Restart',
						systemImage: 'arrow.clockwise',
						tint: systemColors.orange,
						action: () => void performAction('restart', 'restart')
					},
					{
						id: 'pause',
						title: 'Pause',
						systemImage: 'pause.fill',
						tint: systemColors.orange,
						action: () => void performAction('pause', 'pause')
					}
				]
			: []),
		{
			id: 'redeploy',
			title: 'Redeploy',
			systemImage: 'arrow.triangle.2.circlepath',
			tint: accent,
			action: () => startDeployment('containerRedeploy')
		}
	];

	const actionOverflow: ActionButtonItem[] = [
		{
			id: 'inspect',
			title: 'Inspect',
			systemImage: 'doc.text.magnifyingglass',
			tint: accent,
			action: () => nav.openSubpage('inspect', environmentID, container.id)
		},
		{
			id: 'download-logs',
			title: 'Download Logs',
			systemImage: 'square.and.arrow.down',
			tint: accent,
			action: () => void downloadLogs()
		},
		...(isRBAC && hasPermission('containers:edit', environmentID)
			? [
					{
						id: 'edit',
						title: 'Edit',
						systemImage: 'slider.horizontal.3',
						tint: accent,
						action: openEdit
					}
				]
			: []),
		...(isRBAC && hasPermission('images:commit', environmentID)
			? [
					{
						id: 'commit',
						title: 'Commit to Image',
						systemImage: 'square.3.layers.3d.top.filled',
						tint: accent,
						action: () => nav.openSubpage('commit', environmentID, container.id)
					}
				]
			: []),
		...(isRunning && !isPaused
			? [
					{
						id: 'terminal',
						title: 'Terminal',
						systemImage: 'terminal.fill',
						tint: accent,
						action: () => nav.openTerminal(environmentID, container.id, displayedName)
					}
				]
			: []),
		{
			id: 'rename',
			title: 'Rename',
			systemImage: 'pencil',
			tint: accent,
			action: () => nav.openSubpage('rename', environmentID, container.id, { name: displayedName })
		},
		...(isRunning && hasPermission('containers:kill', environmentID)
			? [
					{
						id: 'kill',
						title: 'Kill',
						systemImage: 'bolt.fill',
						tint: systemColors.red,
						role: 'destructive' as const,
						confirmationMessage:
							'This sends SIGKILL and stops the container immediately without a graceful shutdown.',
						action: () => void performAction('kill', 'kill')
					}
				]
			: []),
		{
			id: 'delete',
			title: 'Delete',
			systemImage: 'trash',
			tint: systemColors.red,
			role: 'destructive',
			confirmationMessage: 'This will permanently delete the container and cannot be undone.',
			action: () => void deleteContainer()
		}
	];

	// MARK: Overview content

	const metadata: ResourceMetadataItem[] = details
		? (() => {
				const primaryAddress =
					Object.entries(details.networkSettings.networks)
						.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
						.map(([, endpoint]) => nonEmpty(endpoint.ipAddress))
						.find((value) => value !== undefined) ?? 'Unavailable';
				const health = nonEmpty(details.state.health?.status) ?? 'Not configured';
				return [
					{
						label: 'Image',
						value: nonEmpty(details.image) ?? container.image,
						systemImage: 'square.3.layers.3d.top.filled'
					},
					{
						label: 'Uptime / Status',
						value: nonEmpty(containerStatusText(container.status)) ?? statusString,
						systemImage: 'clock'
					},
					{ label: 'Address', value: primaryAddress, systemImage: 'network', monospaced: true },
					{
						label: 'Health',
						value: capitalized(health),
						systemImage: 'heart.text.square',
						tint: health.toLowerCase() === 'healthy' ? systemColors.green : undefined
					}
				];
			})()
		: [];

	return {
		environmentID,
		container,
		details,
		isLoading,
		isActioning,
		runningActionID,
		selectedTab,
		setSelectedTab,
		availableTabs,
		statusString,
		isRunning,
		isPaused,
		displayedName,
		headerIconUrl,
		statusIndicatorColor,
		metadata,
		autoUpdateEnabled,
		canAutoUpdate: hasPermission(Permission.Containers.autoUpdate, environmentID),
		isSavingAutoUpdate,
		setAutoUpdate: (enabled: boolean) => void setAutoUpdate(enabled),
		loadDetails,
		toolbar: { primary: actionPrimary, secondary: actionSecondary, overflow: actionOverflow },
		openSubpage: nav.openSubpage,
		openLogsFullScreen: (storeToken: string) =>
			nav.openLogs(environmentID, container.id, displayedName, storeToken)
	};
}

export type ContainerDetailModel = ReturnType<typeof useContainerDetail>;
