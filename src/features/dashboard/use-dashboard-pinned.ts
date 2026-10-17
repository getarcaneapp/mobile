/**
 * Data and actions for `DashboardPinnedSection` (DashboardPinnedSection.swift):
 * the active environment's pinned containers and projects, with a start/stop
 * (deploy/down) quick action per row.
 */
import { useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { ProjectDetails } from '@/sdk/models/project/Project';
import { useClientManager } from '@/stores/client-manager';
import { usePinnedItemsStore } from '@/stores/pinned-items-store';
import { useResourceMutationStore, useResourceVersion } from '@/stores/resource-mutation-store';
import { systemColors } from '@/theme/colors';
import { showToast, Toasts } from '@/ui/toast';

import {
	capitalized,
	containerDisplayName,
	containerIsRunning,
	projectIsRunning
} from './dashboard-logic';

/** Port of `DashboardPinnedItem`. */
export type DashboardPinnedItem =
	| { kind: 'container'; container: ContainerSummary }
	| { kind: 'project'; project: ProjectDetails };

export const PinnedItem = {
	id: (item: DashboardPinnedItem) =>
		item.kind === 'container' ? `container-${item.container.id}` : `project-${item.project.id}`,
	title: (item: DashboardPinnedItem) =>
		item.kind === 'container' ? containerDisplayName(item.container) : item.project.name,
	isRunning: (item: DashboardPinnedItem) =>
		item.kind === 'container' ? containerIsRunning(item.container) : projectIsRunning(item.project),
	status: (item: DashboardPinnedItem) =>
		item.kind === 'container'
			? containerIsRunning(item.container)
				? 'Running'
				: 'Stopped'
			: capitalized(item.project.status),
	icon: (item: DashboardPinnedItem) =>
		item.kind === 'container' ? 'cube.box.fill' : 'folder.fill',
	tint: (item: DashboardPinnedItem) =>
		item.kind === 'container' ? systemColors.orange : systemColors.blue,
	actionTitle: (item: DashboardPinnedItem) => {
		const running = PinnedItem.isRunning(item);
		return item.kind === 'container'
			? running
				? 'Stop Container'
				: 'Start Container'
			: running
				? 'Stop Project'
				: 'Deploy Project';
	},
	actionSystemImage: (item: DashboardPinnedItem) =>
		PinnedItem.isRunning(item) ? 'stop.fill' : 'play.fill',
	actionTint: (item: DashboardPinnedItem) =>
		PinnedItem.isRunning(item) ? systemColors.red : systemColors.green
} as const;

export function useDashboardPinned(refreshToken: number) {
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const pinVersion = usePinnedItemsStore((s) => s.version);
	const containerVersion = useResourceVersion('containers', environmentID);
	const projectVersion = useResourceVersion('projects', environmentID);

	const [containers, setContainers] = useState<ContainerSummary[]>([]);
	const [projects, setProjects] = useState<ProjectDetails[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [runningID, setRunningID] = useState<string>();
	const generation = useRef(0);
	const itemCount = useRef(0);

	const items: DashboardPinnedItem[] = [
		...containers.map((container) => ({ kind: 'container' as const, container })),
		...projects.map((project) => ({ kind: 'project' as const, project }))
	];
	itemCount.current = items.length;

	// Loads once, then on environment, pin, mutation, and refresh-token changes.
	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			const client = useClientManager.getState().client;
			const cached = cachedClient();
			if (!client || !cached) return;
			const requested = environmentID;
			generation.current += 1;
			const mine = generation.current;
			if (itemCount.current === 0) setIsLoading(true);
			const pins = usePinnedItemsStore.getState();
			const pinnedContainers = pins.pinnedIDs('container', requested);
			const pinnedProjects = pins.pinnedIDs('project', requested);
			const [nextContainers, nextProjects] = await Promise.all([
				pinnedContainers.size === 0
					? Promise.resolve([] as ContainerSummary[])
					: cached
							.getAllPages<ContainerSummary>(
								client.rest.environmentPath(requested, 'containers'),
								requested,
								async (start, limit) => {
									const response = await client.containers.list({
										envID: requested,
										query: { start, limit }
									});
									return { items: response.data, pagination: response.pagination };
								}
							)
							.then((all) => all.filter((c) => pinnedContainers.has(c.id)))
							.catch(() => [] as ContainerSummary[]),
				pinnedProjects.size === 0
					? Promise.resolve([] as ProjectDetails[])
					: cached
							.getAllPages<ProjectDetails>(
								client.rest.environmentPath(requested, 'projects'),
								requested,
								async (start, limit) => {
									const response = await client.projects.list({
										envID: requested,
										query: { start, limit }
									});
									return { items: response.data, pagination: response.pagination };
								}
							)
							.then((all) => all.filter((p) => pinnedProjects.has(p.id)))
							.catch(() => [] as ProjectDetails[])
			]);
			if (generation.current === mine) setIsLoading(false);
			if (
				cancelled ||
				generation.current !== mine ||
				requested !== useClientManager.getState().activeEnvironmentID
			)
				return;
			setContainers(nextContainers);
			setProjects(nextProjects);
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [environmentID, pinVersion, containerVersion, projectVersion, refreshToken]);

	const runAction = async (item: DashboardPinnedItem) => {
		const client = useClientManager.getState().client;
		const cached = cachedClient();
		if (!client || runningID !== undefined) return;
		setRunningID(PinnedItem.id(item));
		const mutations = useResourceMutationStore.getState();
		try {
			if (item.kind === 'container') {
				if (containerIsRunning(item.container)) {
					await client.containers.stop({ envID: environmentID, id: item.container.id });
					showToast(Toasts.success('Container stopped'));
				} else {
					await client.containers.start({ envID: environmentID, id: item.container.id });
					showToast(Toasts.success('Container started'));
				}
				cached?.invalidate(environmentID, [
					client.rest.environmentPath(environmentID, 'containers'),
					client.rest.environmentPath(environmentID, 'containers/*')
				]);
				mutations.markChanged('containers', environmentID);
			} else {
				if (projectIsRunning(item.project)) {
					await client.projects.down({ envID: environmentID, projectID: item.project.id });
					showToast(Toasts.success('Project stopped'));
				} else {
					await client.projects.deploy({ envID: environmentID, projectID: item.project.id });
					showToast(Toasts.success('Project deployed'));
				}
				cached?.invalidate(environmentID, [
					client.rest.environmentPath(environmentID, 'projects') + '*',
					client.rest.environmentPath(environmentID, 'projects/*')
				]);
				mutations.markChanged('projects', environmentID);
			}
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		} finally {
			setRunningID(undefined);
		}
	};

	return { items, isLoading, runningID, runAction };
}
