/**
 * The platform-neutral model behind ProjectDetailView.swift: project, runtime
 * services, and workspace file loading; lifecycle actions (streaming ones go
 * through the project deployment store); per-service actions; archive,
 * delete; and the resource-actions toolbar items.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import { boundedAPIResponse, RemoteDataLimits } from '@/core/networking/remote-data-limits';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import {
	ProjectDetails,
	type DeployOptions,
	type RuntimeService
} from '@/sdk/models/project/Project';
import type { ProjectFile } from '@/sdk/models/project/ProjectFiles';
import type { ProjectTag } from '@/sdk/models/project/ProjectTag';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import {
	useProjectDeploymentStore,
	type ProjectDeploymentKind
} from '@/stores/project-deployment-store';
import { useResourceMutationStore, useResourceVersion } from '@/stores/resource-mutation-store';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { containerDisplayName, containerIsRunning } from '@/features/containers/container-model';
import { useContainerNavigation } from '@/features/containers/container-routes';
import { useOnChange } from '@/features/containers/hooks';

import {
	ProjectFileWorkspaceHelpers,
	type ManagedProjectFileEntry,
	type ProjectFilesDestination
} from './project-files-model';
import {
	composeOverrideNames,
	containerIDMatches,
	projectComposeFileName,
	projectDisplayName,
	projectIsRunning
} from './project-model';
import { projectCache, useProjectNavigation } from './project-routes';

export type WorkspaceSection = 'services' | 'logs';

export const workspaceSections: {
	value: WorkspaceSection;
	title: string;
	systemImage: string;
	tint: string;
}[] = [
	{
		value: 'services',
		title: 'Services',
		systemImage: 'shippingbox.fill',
		tint: systemColors.blue
	},
	{ value: 'logs', title: 'Logs', systemImage: 'text.alignleft', tint: systemColors.teal }
];

export type ServiceAction = 'start' | 'stop' | 'restart' | 'remove';

export type RuntimeRow = { id: string; service: RuntimeService; container?: ContainerSummary };

/** Placeholder until the project loads (a route opened without a cached value). */
function placeholderProject(id: string, name: string): ProjectDetails {
	return ProjectDetails.make({ id, name, path: '', status: '', createdAt: '', updatedAt: '' });
}

/** Keeps the environment containers that belong to this project, running-first then by name. */
function filterProjectContainers(all: ContainerSummary[], ids: Set<string>): ContainerSummary[] {
	return all
		.filter((container) => [...ids].some((id) => containerIDMatches(container.id, id)))
		.sort((lhs, rhs) => {
			const l = containerIsRunning(lhs);
			const r = containerIsRunning(rhs);
			if (l !== r) return l ? -1 : 1;
			return containerDisplayName(lhs).localeCompare(containerDisplayName(rhs), undefined, {
				sensitivity: 'base'
			});
		});
}

export function useProjectDetail(
	environmentID: EnvironmentID,
	projectID: string,
	initialName = ''
) {
	const router = useRouter();
	const nav = useProjectNavigation();
	const containerNav = useContainerNavigation();
	const accent = useAccentColor();
	const [project] = useState<ProjectDetails>(
		() => projectCache.get(environmentID, projectID) ?? placeholderProject(projectID, initialName)
	);
	const [refreshedProject, setRefreshedProject] = useState<ProjectDetails>();
	const [isLoading, setIsLoading] = useState(false);
	const [isActioning, setIsActioning] = useState(false);
	const [actionStatus, setActionStatus] = useState<string>();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [runningActionID, setRunningActionID] = useState<string>();
	const [projectContainers, setProjectContainers] = useState<ContainerSummary[]>([]);
	const [runtimeServices, setRuntimeServices] = useState<RuntimeService[]>([]);
	const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('services');
	const [servicesLoading, setServicesLoading] = useState(false);
	const [fileBrowserFiles, setFileBrowserFiles] = useState<ProjectFile[]>();
	const [fileBrowserLoading, setFileBrowserLoading] = useState(false);
	const [fileBrowserErrorMessage, setFileBrowserErrorMessage] = useState<string>();
	useClientManager((s) => s.accessGeneration);
	const supportsPost26 = useClientManager((s) => s.supportsPost26MobileFeatures);

	const currentProject = refreshedProject ?? project;
	const isRunning = projectIsRunning(currentProject);
	const hasBuild = currentProject.hasBuildDirective === true;
	const displayName = projectDisplayName(currentProject);

	const latest = useRef({ projectContainers, fileBrowserFiles, refreshedProject });
	latest.current = { projectContainers, fileBrowserFiles, refreshedProject };

	// MARK: Loading

	const loadProject = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		if (latest.current.refreshedProject === undefined) setIsLoading(true);
		try {
			const path = client.rest.environmentPath(environmentID, `projects/${projectID}`);
			const result = await boundedAPIResponse(client, path, {
				maximumBytes: RemoteDataLimits.maximumInspectBytes,
				decode: ProjectDetails.decode
			});
			projectCache.set(environmentID, result);
			setRefreshedProject(result);
			setErrorMessage(undefined);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsLoading(false);
		}
	}, [environmentID, projectID]);

	const loadProjectFiles = useCallback(
		async (refresh = false) => {
			const client = useClientManager.getState().client;
			if (!client) return;
			if (latest.current.fileBrowserFiles === undefined) setFileBrowserLoading(true);
			setFileBrowserErrorMessage(undefined);
			try {
				const workspace = await client.projects.workspace({ envID: environmentID, projectID });
				setFileBrowserFiles(workspace.files);
			} catch (error) {
				if (refresh || latest.current.fileBrowserFiles === undefined)
					setFileBrowserErrorMessage(friendlyErrorMessage(error));
			} finally {
				setFileBrowserLoading(false);
			}
		},
		[environmentID, projectID]
	);

	/**
	 * Loads runtime services first so Compose entries without containers remain
	 * visible, then resolves their IDs against the complete cached container list.
	 */
	const loadServices = useCallback(async () => {
		const client = useClientManager.getState().client;
		const cached = cachedClient();
		if (!client || !cached) return;
		if (latest.current.projectContainers.length === 0) setServicesLoading(true);
		try {
			const runtime = await client.projects.runtime({ envID: environmentID, projectID });
			const services = runtime.runtimeServices ?? [];
			setRuntimeServices(services);
			const ids = new Set(
				services
					.map((s) => s.containerId)
					.filter((id): id is string => id !== undefined && id !== '')
			);
			const all = await cached.getAllPages<ContainerSummary>(
				client.rest.environmentPath(environmentID, 'containers'),
				environmentID,
				async (start, limit) => {
					const response = await client.containers.list({
						envID: environmentID,
						query: { start, limit }
					});
					return { items: response.data, pagination: response.pagination };
				}
			);
			setProjectContainers(filterProjectContainers(all, ids));
		} catch {
			// Non-fatal: the project info still renders; the Services section shows its empty state.
		} finally {
			setServicesLoading(false);
		}
	}, [environmentID, projectID]);

	const reloadAll = useCallback(async () => {
		await loadProject();
		await loadServices();
		await loadProjectFiles(true);
	}, [loadProject, loadServices, loadProjectFiles]);

	// `.task` ×3 (first appear), plus a refresh when coming back to the screen.
	const hasAppeared = useRef(false);
	useFocusEffect(
		useCallback(() => {
			if (hasAppeared.current) return;
			hasAppeared.current = true;
			void loadProject();
			void loadServices();
			void loadProjectFiles();
		}, [loadProject, loadServices, loadProjectFiles])
	);

	useOnChange(useResourceVersion('containers', environmentID), () => void loadServices());
	useOnChange(useResourceVersion('projects', environmentID), () => void reloadAll());

	// MARK: Derived

	const fileBrowserEntries: ManagedProjectFileEntry[] = useMemo(
		() =>
			ProjectFileWorkspaceHelpers.apply(fileBrowserFiles ?? currentProject.projectFiles ?? [], []),
		[fileBrowserFiles, currentProject.projectFiles]
	);

	/** Only compose override files earn a pinned row next to compose/.env. */
	const pinnedFileBrowserEntries = useMemo(
		() =>
			fileBrowserEntries.filter(
				(entry) =>
					ProjectFileWorkspaceHelpers.parentPath(entry.relativePath) === '' &&
					!entry.isDirectory &&
					composeOverrideNames.has(entry.name.toLowerCase())
			),
		[fileBrowserEntries]
	);

	const runtimeRows: RuntimeRow[] = useMemo(
		() =>
			runtimeServices.map((service) => {
				const serviceID = service.containerId;
				const container = serviceID
					? projectContainers.find((c) => containerIDMatches(c.id, serviceID))
					: undefined;
				return { id: service.name, service, container };
			}),
		[runtimeServices, projectContainers]
	);

	const environmentName = () =>
		useEnvironmentsStore.getState().displayName(environmentID) ??
		useClientManager.getState().activeEnvironmentName;

	// MARK: Actions

	const invalidate = () => {
		const client = useClientManager.getState().client;
		const cached = cachedClient();
		if (!client || !cached) return;
		const path = (suffix: string) => client.rest.environmentPath(environmentID, suffix);
		cached.invalidate(environmentID, [
			path('projects') + '*',
			path('projects/*'),
			path('containers'),
			path('containers/*')
		]);
	};

	const markChanged = (kind: 'projects' | 'containers') =>
		useResourceMutationStore.getState().markChanged(kind, environmentID);

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	/**
	 * Hands the operation to the app-level store: it owns the stream and the
	 * sheet. Completion bumps the projects mutation version, which this screen
	 * observes to reload itself.
	 */
	const startStreamingAction = (kind: ProjectDeploymentKind, deployOptions?: DeployOptions) => {
		setErrorMessage(undefined);
		setActionStatus(undefined);
		useProjectDeploymentStore.getState().start({
			kind,
			envID: environmentID,
			targetID: projectID,
			targetName: displayName,
			environmentName: environmentName(),
			deployOptions,
			presentSheet: nav.openDeployment
		});
	};

	const performSimpleAction = async (suffix: string, label: string, actionID?: string) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsActioning(true);
		setRunningActionID(actionID);
		setActionStatus(`${label}…`);
		setErrorMessage(undefined);
		try {
			await client.rest.post<unknown>(
				client.rest.environmentPath(environmentID, `projects/${projectID}/${suffix}`)
			);
			setActionStatus('Done.');
			invalidate();
			markChanged('projects');
			await loadProject();
			await loadServices();
			showToast(Toasts.success('Action complete'));
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
			setActionStatus(undefined);
			void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
		} finally {
			setIsActioning(false);
			setRunningActionID(undefined);
		}
	};

	const runAndDismiss = async (status: string, run: () => Promise<unknown>, success: string) => {
		if (!useClientManager.getState().client) return;
		setIsActioning(true);
		setActionStatus(status);
		setErrorMessage(undefined);
		try {
			await run();
			invalidate();
			markChanged('projects');
			showToast(Toasts.success(success));
			dismiss();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
			setActionStatus(undefined);
		} finally {
			setIsActioning(false);
		}
	};

	const deleteProject = (removeFiles: boolean) =>
		runAndDismiss(
			'Deleting…',
			() =>
				useClientManager.getState().client!.projects.destroy({
					envID: environmentID,
					projectID,
					options: { removeFiles, removeVolumes: false }
				}),
			'Project deleted'
		);

	const archiveProject = () =>
		runAndDismiss(
			'Archiving…',
			() =>
				useClientManager
					.getState()
					.client!.rest.post<unknown>(
						useClientManager
							.getState()
							.client!.rest.environmentPath(environmentID, `projects/${projectID}/archive`)
					),
			'Project archived'
		);

	const unarchiveProject = () =>
		runAndDismiss(
			'Unarchiving…',
			() =>
				useClientManager
					.getState()
					.client!.rest.post<unknown>(
						useClientManager
							.getState()
							.client!.rest.environmentPath(environmentID, `projects/${projectID}/unarchive`)
					),
			'Project unarchived'
		);

	const performServiceAction = async (action: ServiceAction, row: RuntimeRow) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			const id = row.container?.id;
			switch (action) {
				case 'start':
					if (!id) return;
					await client.containers.start({ envID: environmentID, id });
					break;
				case 'stop':
					if (!id) return;
					await client.containers.stop({ envID: environmentID, id });
					break;
				case 'restart':
					await client.projects.restart({
						envID: environmentID,
						projectID,
						services: [row.service.name]
					});
					break;
				case 'remove':
					if (!id) return;
					await client.containers.delete({ envID: environmentID, id, force: true });
					break;
			}
			invalidate();
			markChanged('containers');
			await loadServices();
			showToast(Toasts.success('Service action complete'));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	const servicePermissions = {
		stop: hasPermission(Permission.Containers.stop, environmentID),
		start: hasPermission(Permission.Containers.start, environmentID),
		restart: hasPermission(Permission.Projects.restart, environmentID),
		remove: hasPermission(Permission.Containers.delete, environmentID)
	};

	const openDeployOptions = () =>
		nav.openDeployOptions(environmentID, {
			deploy: (options) => startStreamingAction('up', options)
		});

	const openTags = () =>
		nav.openTags(environmentID, projectID, {
			tags: (currentProject.tags ?? []).filter((tag) => tag.name !== ''),
			onChange: (tags: ProjectTag[]) => {
				setRefreshedProject((current) => ({ ...(current ?? project), tags }));
				markChanged('projects');
			}
		});

	const openFiles = (selection: ProjectFilesDestination) =>
		nav.openFiles(environmentID, currentProject, selection);

	const openContainer = (container: ContainerSummary) =>
		containerNav.openDetail(environmentID, container);

	// MARK: Toolbar

	/** State-aware centre action: Deploy when stopped, Stop when running. */
	const actionPrimary: ActionButtonItem = isRunning
		? {
				id: 'stop',
				title: 'Stop',
				systemImage: 'stop.fill',
				tint: systemColors.red,
				role: 'destructive',
				action: () => void performSimpleAction('down', 'Stopping', 'stop')
			}
		: {
				id: 'start',
				title: 'Deploy',
				systemImage: 'play.fill',
				tint: systemColors.green,
				action: () => startStreamingAction('up')
			};

	const actionSecondary: ActionButtonItem[] = [
		...(isRunning
			? [
					{
						id: 'restart',
						title: 'Restart',
						systemImage: 'arrow.clockwise',
						tint: systemColors.orange,
						action: () => void performSimpleAction('restart', 'Restarting', 'restart')
					}
				]
			: []),
		{
			id: 'redeploy',
			title: 'Redeploy',
			systemImage: 'arrow.triangle.2.circlepath',
			tint: systemColors.purple,
			action: () => startStreamingAction('redeploy')
		},
		{
			id: 'pull',
			title: 'Pull',
			systemImage: 'arrow.down',
			tint: accent,
			action: () => startStreamingAction('pull')
		}
	];

	const actionOverflow: ActionButtonItem[] = [];
	if (supportsPost26) {
		actionOverflow.push({
			id: 'deploy-options',
			title: 'Deploy Options',
			systemImage: 'slider.horizontal.3',
			tint: systemColors.green,
			action: openDeployOptions
		});
	}
	if (hasBuild) {
		actionOverflow.push({
			id: 'build',
			title: 'Build',
			systemImage: 'hammer.fill',
			tint: systemColors.indigo,
			action: () => startStreamingAction('build')
		});
	}
	actionOverflow.push({
		id: 'logs',
		title: 'Logs',
		systemImage: 'doc.text.fill',
		tint: systemColors.gray,
		action: () => setWorkspaceSection('logs')
	});
	if (supportsPost26 && hasPermission('projects:update', environmentID)) {
		actionOverflow.push({
			id: 'tags',
			title: 'Edit Tags',
			systemImage: 'tag',
			tint: accent,
			action: openTags
		});
	}
	if (currentProject.isArchived) {
		actionOverflow.push({
			id: 'unarchive',
			title: 'Unarchive Project',
			systemImage: 'tray.and.arrow.up',
			tint: accent,
			action: () => void unarchiveProject()
		});
	} else {
		actionOverflow.push({
			id: 'archive',
			title: 'Archive Project',
			systemImage: 'archivebox',
			tint: accent,
			action: () => void archiveProject()
		});
	}
	// `role: nil` + red tint: keeps the bespoke two-option delete confirmation.
	actionOverflow.push({
		id: 'delete',
		title: 'Delete Project',
		systemImage: 'trash',
		tint: systemColors.red,
		action: () => setShowDeleteConfirm(true)
	});

	useEffect(() => {
		// Keep the cached value fresh for re-pushes (e.g. from the Dashboard).
		if (refreshedProject) projectCache.set(environmentID, refreshedProject);
	}, [environmentID, refreshedProject]);

	return {
		environmentID,
		projectID,
		currentProject,
		displayName,
		isLoading,
		isRunning,
		isActioning,
		actionStatus,
		errorMessage,
		runningActionID,
		runtimeServices,
		runtimeRows,
		servicesLoading,
		workspaceSection,
		setWorkspaceSection,
		composeFileName: projectComposeFileName(currentProject),
		fileBrowserFiles,
		fileBrowserLoading,
		fileBrowserErrorMessage,
		pinnedFileBrowserEntries,
		reloadFiles: () => void loadProjectFiles(true),
		refresh: reloadAll,
		toolbar: { primary: actionPrimary, secondary: actionSecondary, overflow: actionOverflow },
		showDeleteConfirm,
		setShowDeleteConfirm,
		deleteProject: (removeFiles: boolean) => void deleteProject(removeFiles),
		performServiceAction: (action: ServiceAction, row: RuntimeRow) =>
			void performServiceAction(action, row),
		servicePermissions,
		openFiles,
		openContainer,
		openLogsFullScreen: (token: string) =>
			nav.openLogs(environmentID, projectID, displayName, token)
	};
}

export type ProjectDetailModel = ReturnType<typeof useProjectDetail>;
