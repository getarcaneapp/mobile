import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ProjectDetails } from '@/sdk/models/project/Project';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentPagedList, type EnvironmentFetch } from '@/stores/environment-paged-list';
import { useResourceMutationStore, useResourceVersion } from '@/stores/resource-mutation-store';
import { showToast, Toasts } from '@/ui/toast';

import { useOnChange } from '@/features/containers/hooks';

import { invalidateProjectCaches } from './use-projects-list';

const pageSize = 50;

const archivedTime = (project: ProjectDetails) => {
	const time = project.archivedAt ? new Date(project.archivedAt).getTime() : NaN;
	return Number.isNaN(time) ? -Infinity : time;
};

export function useArchivedProjects(environmentID: EnvironmentID) {
	const [list, snapshot] = useEnvironmentPagedList<ProjectDetails>(pageSize);

	const fetch = useCallback((): EnvironmentFetch<ProjectDetails> | undefined => {
		const client = useClientManager.getState().client;
		if (!client) return undefined;
		return async (envID, start, limit) => {
			const response = await client.projects.list({
				envID,
				query: { start, limit },
				archived: 'true'
			});
			return { items: response.data, pagination: response.pagination };
		};
	}, []);

	const load = useCallback(async () => {
		const page = fetch();
		if (page) await list.reload([{ id: environmentID }], page);
	}, [fetch, list, environmentID]);

	const loadMore = useCallback(async () => {
		const page = fetch();
		if (page && list.getSnapshot().hasMore) await list.loadMore(page);
	}, [fetch, list]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);
	useOnChange(useResourceVersion('projects', environmentID), () => void load());

	const displayedProjects = useMemo(
		() =>
			snapshot.items
				.map((item) => item.value)
				.sort((lhs, rhs) => archivedTime(rhs) - archivedTime(lhs)),
		[snapshot.items]
	);

	const unarchive = async (project: ProjectDetails) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			await client.projects.unarchive({ envID: environmentID, projectID: project.id });
			list.updateItems((items) => items.filter((item) => item.value.id !== project.id));
			invalidateProjectCaches(environmentID);
			useResourceMutationStore.getState().markChanged('projects', environmentID);
			showToast(Toasts.success('Project unarchived'));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	return { snapshot, projects: snapshot.items, displayedProjects, load, loadMore, unarchive };
}
