import { useClientManager } from '@/stores/client-manager';

import { JobsScreen } from './jobs-screen';

/**
 * `appTabDestination(.jobs)`: `JobsView(environmentID: manager.activeEnvironmentID,
 * allEnvironments: manager.allEnvironmentsPreview)`. Re-keyed on the
 * environment so switching starts fresh.
 */
export function JobsDestination() {
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const allEnvironments = useClientManager((s) => s.allEnvironmentsPreview);
	return (
		<JobsScreen
			key={`${environmentID}|${allEnvironments}`}
			environmentID={environmentID}
			allEnvironments={allEnvironments}
		/>
	);
}
