import { useClientManager } from '@/stores/client-manager';

import { VolumesScreen } from './volumes-screen';

/**
 * `appTabDestination(.volumes)`: the list for the active environment, or
 * every enabled environment with the All Environments preview. Re-keyed on
 * the environment so switching starts a fresh list.
 */
export function VolumesDestination() {
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const environmentName = useClientManager((s) => s.activeEnvironmentName);
	const allEnvironments = useClientManager((s) => s.allEnvironmentsPreview);
	return (
		<VolumesScreen
			key={`${environmentID}|${allEnvironments}`}
			environmentID={environmentID}
			environmentName={environmentName}
			allEnvironments={allEnvironments}
		/>
	);
}
