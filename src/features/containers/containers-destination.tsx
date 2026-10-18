import { useLocalSearchParams } from 'expo-router';

import { useClientManager } from '@/stores/client-manager';

import { ContainerStateFilters } from './container-model';
import { ContainersScreen } from './containers-screen';

export function ContainersDestination() {
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const environmentName = useClientManager((s) => s.activeEnvironmentName);
	const allEnvironments = useClientManager((s) => s.allEnvironmentsPreview);
	const { state, request } = useLocalSearchParams<{ state?: string; request?: string }>();
	const requestedStateFilter = ContainerStateFilters.find((filter) => filter === state);
	return (
		<ContainersScreen
			key={`${environmentID}|${allEnvironments}`}
			environmentID={environmentID}
			environmentName={environmentName}
			allEnvironments={allEnvironments}
			requestedStateFilter={requestedStateFilter}
			stateFilterRequest={request}
		/>
	);
}
