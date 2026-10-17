import { useClientManager } from '@/stores/client-manager';

import { PortsScreen } from './ports-screen';

export function PortsDestination() {
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const allEnvironments = useClientManager((s) => s.allEnvironmentsPreview);
	return (
		<PortsScreen
			key={`${environmentID}|${allEnvironments}`}
			environmentID={environmentID}
			allEnvironments={allEnvironments}
		/>
	);
}
