import { useClientManager } from '@/stores/client-manager';

import { PodmanScreen } from './podman-screen';

export function PodmanDestination() {
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const environmentName = useClientManager((s) => s.activeEnvironmentName);
	return (
		<PodmanScreen
			key={environmentID}
			environmentID={environmentID}
			environmentName={environmentName}
		/>
	);
}
