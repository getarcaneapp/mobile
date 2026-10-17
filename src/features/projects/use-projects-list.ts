import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { performAllEnvironmentsMaintenance } from '@/core/all-environments-actions';
import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ProjectDetails } from '@/sdk/models/project/Project';
import { Permission } from '@/sdk/models/role/Permission';
import { useAllEnvironmentsOperationStore } from '@/stores/all-environments-operation-store';
import { useClientManager } from '@/stores/client-manager';
import {
	pinnedEnvironmentItemIDs,
	toggleEnvironmentItemPin,
	useEnvironmentPagedList,
	type EnvironmentFetch,
	type EnvironmentItem
} from '@/stores/environment-paged-list';
import { useEnvironmentsStore, type ListEnvironment } from '@/stores/environments-store';
import { usePinnedItemsStore } from '@/stores/pinned-items-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import {
	useAllEnvironmentsMaintenanceConfirmation,
	type AllEnvironmentsMaintenanceAction
} from '@/ui/components/all-environments-maintenance';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { lightHaptic } from '@/features/containers/container-actions';
import { useDebounced, useOnChange } from '@/features/containers/hooks';

import { computeProjectSections, type ProjectSection } from './project-model';
import { useProjectNavigation } from './project-routes';
import {
	projectsActiveFilterCount,
	useProjectsFilter,
	useProjectsFilterStore
} from './projects-filter-store';

const pageSize = 50;

export type ProjectItem = EnvironmentItem<ProjectDetails>;

let listCounter = 0;

export type ProjectsListProps = {
	environmentID: EnvironmentID;
	environmentName: string;
	allEnvironments?: boolean;
};

export function invalidateProjectCaches(environmentID: EnvironmentID, includeContainers = false) {
	const client = useClientManager.getState().client;
	const cached = cachedClient();
	if (!client || !cached) return;
	const path = (suffix: string) => client.rest.environmentPath(environmentID, suffix);
	cached.invalidate(environmentID, [
		path('projects') + '*',
		path('projects/*'),
		...(includeContainers ? [path('containers'), path('containers/*')] : [])
	]);
}

export function useProjectsList({ environmentID, allEnvironments = false }: ProjectsListProps) {
	const nav = useProjectNavigation();
	const client = useClientManager((s) => s.client);
	const [listKey] = useState(() => `projects-${++listCounter}`);
	const filter = useProjectsFilter(listKey);
	const updateFilter = useProjectsFilterStore((s) => s.update);
	useEffect(() => () => useProjectsFilterStore.getState().remove(listKey), [listKey]);

	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);

	const [list, snapshot] = useEnvironmentPagedList<ProjectDetails>(pageSize);
	const projects = snapshot.items;
	const pinVersion = usePinnedItemsStore((s) => s.version);
	const environments = useEnvironmentsStore((s) => s.environments);

	const [pendingDelete, setPendingDelete] = useState<ProjectItem>();
	const [actionErrorMessage, setActionErrorMessage] = useState<string>();
	const [pendingMaintenance, setPendingMaintenance] = useState<AllEnvironmentsMaintenanceAction>();
	const isOperationRunning = useAllEnvironmentsOperationStore((s) => s.isRunning);

	const listEnvironments: ListEnvironment[] = useMemo(
		() => (allEnvironments ? snapshot.environments : [{ id: environmentID }]),
		[allEnvironments, snapshot.environments, environmentID]
	);

	useEffect(() => {
		updateFilter(listKey, { environments: snapshot.environments, listEnvironments });
	}, [listKey, snapshot.environments, listEnvironments, updateFilter]);

	const tagsRef = useRef(filter.tagFilter);
	tagsRef.current = filter.tagFilter;

	const projectsPage = useCallback((): EnvironmentFetch<ProjectDetails> | undefined => {
		const current = useClientManager.getState().client;
		if (!current) return undefined;
		const tagFilter = tagsRef.current;
		const tags = tagFilter.length === 0 ? undefined : [...tagFilter].sort().join(',');
		return async (envID, start, limit) => {
			const response = await current.projects.list({ envID, query: { start, limit }, tags });
			return { items: response.data, pagination: response.pagination };
		};
	}, []);

	const loadProjects = useCallback(
		async (preservingLoadedRange = false) => {
			const fetch = projectsPage();
			if (!fetch) return;
			const lists = await useEnvironmentsStore
				.getState()
				.listEnvironments(environmentID, allEnvironments);
			await list.reload(lists, fetch, { preservingLoadedRange });
		},
		[projectsPage, list, environmentID, allEnvironments]
	);

	const loadMore = useCallback(async () => {
		const fetch = projectsPage();
		if (fetch) await list.loadMore(fetch);
	}, [projectsPage, list]);

	useFocusEffect(
		useCallback(() => {
			void loadProjects(true);
		}, [loadProjects])
	);

	const mutationVersion = useResourceMutationStore((s) =>
		(allEnvironments ? snapshot.environments.map((e) => e.id) : [environmentID]).reduce(
			(total, id) => total + (s.versions[`projects::${id}`] ?? 0),
			0
		)
	);
	useOnChange(mutationVersion, () => void loadProjects(true));
	useOnChange(filter.tagFilter.join(','), () => void loadProjects());
	useOnChange(client, () => void loadProjects());

	const pinnedIDs = useMemo(() => {
		void pinVersion;
		return pinnedEnvironmentItemIDs('project', projects);
	}, [projects, pinVersion]);

	const sections: ProjectSection<ProjectItem>[] = useMemo(
		() =>
			computeProjectSections(
				projects,
				{
					search: debouncedSearch,
					environmentFilter: filter.environmentFilter,
					statusFilter: filter.statusFilter,
					updateFilter: filter.updateFilter,
					sortOrder: filter.sortOrder
				},
				pinnedIDs
			),
		[
			projects,
			debouncedSearch,
			filter.environmentFilter,
			filter.statusFilter,
			filter.updateFilter,
			filter.sortOrder,
			pinnedIDs
		]
	);

	useClientManager((s) => s.accessGeneration);
	const canBrowseTemplates =
		hasPermission(Permission.Templates.list, null) &&
		hasPermission(Permission.Templates.read, null);
	const createEnvironments = listEnvironments.filter((e) =>
		hasPermission(Permission.Projects.create, e.id)
	);
	const enabledEnvironments = environments.filter((e) => e.enabled);

	const togglePin = useCallback((item: ProjectItem) => {
		lightHaptic();
		toggleEnvironmentItemPin(item, 'project');
	}, []);

	const togglePinAfterSwipe = useCallback(
		(item: ProjectItem) => setTimeout(() => togglePin(item), 250),
		[togglePin]
	);

	const deleteProject = async (item: ProjectItem, removeFiles: boolean) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		setPendingDelete(undefined);
		try {
			await current.projects.destroy({
				envID: item.environmentID,
				projectID: item.value.id,
				options: { removeFiles, removeVolumes: false }
			});
			list.updateItems((items) => items.filter((other) => other.id !== item.id));
			invalidateProjectCaches(item.environmentID);
			useResourceMutationStore.getState().markChanged('projects', item.environmentID);
			showToast(Toasts.success('Project deleted'));
		} catch (error) {
			setActionErrorMessage(friendlyErrorMessage(error));
		}
	};

	useItemDeleteConfirmation(pendingDelete, setPendingDelete, (item) => ({
		title: 'Delete Project',
		message: 'Remove the project from Arcane, or also remove its files from disk.',
		icon: 'trash',
		actions: [
			{ title: 'Delete', action: () => void deleteProject(item, false) },
			{ title: 'Delete and Remove Files', action: () => void deleteProject(item, true) }
		],
		dismissOnConfirm: false
	}));

	useEffect(() => {
		if (actionErrorMessage === undefined) return;
		Alert.alert(
			"Couldn't Delete Project",
			actionErrorMessage,
			[{ text: 'OK', style: 'cancel', onPress: () => setActionErrorMessage(undefined) }],
			{ onDismiss: () => setActionErrorMessage(undefined) }
		);
	}, [actionErrorMessage]);

	useAllEnvironmentsMaintenanceConfirmation(pendingMaintenance, setPendingMaintenance, (action) => {
		void performAllEnvironmentsMaintenance(action, enabledEnvironments);
	});

	return {
		listKey,
		allEnvironments,
		environmentID,
		snapshot,
		projects,
		sections,
		pinnedIDs,
		searchText,
		setSearchText,
		filter,
		activeFilterCount: projectsActiveFilterCount(filter),
		openFilter: () => nav.openFilter(listKey),
		loadProjects,
		loadMore,
		refresh: () => loadProjects(),
		openDetail: (item: ProjectItem) => nav.openDetail(item.environmentID, item.value),
		togglePin,
		togglePinAfterSwipe,
		requestDelete: setPendingDelete,
		canBrowseTemplates,
		openTemplates: nav.openTemplates,
		listEnvironments,
		createEnvironments,
		presentCreateProject: (envID: EnvironmentID) => nav.openCreate(envID),
		openArchived: nav.openArchived,
		isOperationRunning,
		selectMaintenance: setPendingMaintenance
	};
}

export type ProjectsListModel = ReturnType<typeof useProjectsList>;
