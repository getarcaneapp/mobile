import { useClientManager } from '@/stores/client-manager';

import { PortsScreen } from './ports-screen';

/** `appTabDestination(.ports)`: re-keyed on the environment so switching starts a fresh list. */
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
