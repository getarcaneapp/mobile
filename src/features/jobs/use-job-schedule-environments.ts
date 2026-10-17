/**
 * `JobsView.scheduleEnvironments` (JobsView.swift): schedules are
 * per-environment settings, so All Environments picks the environment to
 * configure first.
 */
import { useEffect } from 'react';

import { environmentDisplayName, useEnvironmentsStore } from '@/stores/environments-store';

import { useJobsNavigation } from './jobs-routes';

export function useJobScheduleEnvironments() {
	const navigation = useJobsNavigation();
	const hasLoaded = useEnvironmentsStore((s) => s.hasLoaded);
	// Re-render on catalog changes; `enabledEnvironments()` reads the latest list.
	useEnvironmentsStore((s) => s.environments);
	const environments = useEnvironmentsStore
		.getState()
		.enabledEnvironments()
		.map((environment) => ({
			id: environment.id,
			displayName: environmentDisplayName(environment)
		}));

	// `.task { await environmentsStore.load(manager: manager) }`
	useEffect(() => {
		void useEnvironmentsStore.getState().load();
	}, []);

	return {
		environments,
		showsEmpty: hasLoaded && environments.length === 0,
		refresh: () => useEnvironmentsStore.getState().load({ refresh: true }),
		open: (environment: { id: string; displayName: string }) =>
			navigation.openSchedules(environment.id, environment.displayName)
	};
}
