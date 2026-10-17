/**
 * ProjectsView's Filter sheet state: edits the list that opened it and loads
 * the tag catalog across the list's environments (`loadTagOptions()`).
 */
import { useEffect } from 'react';

import { useClientManager } from '@/stores/client-manager';

import { localizedStandardCompare } from '@/features/containers/container-model';

import type { ProjectTagOption } from './project-model';
import {
	useProjectsFilter,
	useProjectsFilterStore,
	type ProjectsFilterState
} from './projects-filter-store';

export function useProjectsFilterScreen(key: string) {
	const filter = useProjectsFilter(key);
	const update = (patch: Partial<ProjectsFilterState>) =>
		useProjectsFilterStore.getState().update(key, patch);

	// `.task { await loadTagOptions() }`: tags are unavailable on older servers.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const { client, supportsPost26MobileFeatures } = useClientManager.getState();
			if (!client || !supportsPost26MobileFeatures) return;
			const environments = useProjectsFilterStore.getState().lists[key]?.listEnvironments ?? [];
			const byName = new Map<string, ProjectTagOption>();
			for (const environment of environments) {
				let options: ProjectTagOption[] = [];
				try {
					options =
						(await client.rest.get<ProjectTagOption[]>(
							client.rest.environmentPath(environment.id, 'projects/tags')
						)) ?? [];
				} catch {
					options = [];
				}
				for (const option of options) if (!byName.has(option.name)) byName.set(option.name, option);
			}
			if (cancelled) return;
			useProjectsFilterStore.getState().update(key, {
				tagOptions: [...byName.values()].sort((a, b) => localizedStandardCompare(a.name, b.name))
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [key]);

	const toggleTag = (name: string) => {
		const current = useProjectsFilterStore.getState().lists[key]?.tagFilter ?? [];
		update({
			tagFilter: current.includes(name) ? current.filter((t) => t !== name) : [...current, name]
		});
	};

	return { filter, update, toggleTag };
}
