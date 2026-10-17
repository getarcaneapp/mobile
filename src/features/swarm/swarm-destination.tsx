import { useClientManager } from '@/stores/client-manager';

import { SwarmScreen } from './swarm-screen';

/** `appTabDestination(.swarm)`: the hub for the active environment (re-keyed on it, `.task(id: environmentID)`). */
export function SwarmDestination() {
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const environmentName = useClientManager((s) => s.activeEnvironmentName);
	return (
		<SwarmScreen
			key={environmentID}
			environmentID={environmentID}
			environmentName={environmentName}
		/>
	);
}
