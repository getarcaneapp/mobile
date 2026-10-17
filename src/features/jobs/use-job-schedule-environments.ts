import { useEffect } from 'react';

import { environmentDisplayName, useEnvironmentsStore } from '@/stores/environments-store';

import { useJobsNavigation } from './jobs-routes';

export function useJobScheduleEnvironments() {
	const navigation = useJobsNavigation();
	const hasLoaded = useEnvironmentsStore((s) => s.hasLoaded);
	useEnvironmentsStore((s) => s.environments);
	const environments = useEnvironmentsStore
		.getState()
		.enabledEnvironments()
		.map((environment) => ({
			id: environment.id,
			displayName: environmentDisplayName(environment)
		}));

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
