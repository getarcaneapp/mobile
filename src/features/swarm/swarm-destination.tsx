import { useClientManager } from '@/stores/client-manager';

import { SwarmScreen } from './swarm-screen';

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
