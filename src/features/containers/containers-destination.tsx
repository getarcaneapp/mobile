import { useClientManager } from '@/stores/client-manager';

import { ContainersScreen } from './containers-screen';

/**
 * `appTabDestination(.containers)`: the list for the active environment, or
 * every enabled environment with the All Environments preview. Re-keyed on
 * the environment so switching starts a fresh list.
 */
export function ContainersDestination() {
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const environmentName = useClientManager((s) => s.activeEnvironmentName);
	const allEnvironments = useClientManager((s) => s.allEnvironmentsPreview);
	return (
		<ContainersScreen
			key={`${environmentID}|${allEnvironments}`}
			environmentID={environmentID}
			environmentName={environmentName}
			allEnvironments={allEnvironments}
		/>
	);
}
