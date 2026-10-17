import { useClientManager } from '@/stores/client-manager';

import { ProjectsScreen } from './projects-screen';

/**
 * `appTabDestination(.projects)`: the list for the active environment, or
 * every enabled environment with the All Environments preview. Re-keyed on
 * the environment so switching starts a fresh list.
 */
export function ProjectsDestination() {
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const environmentName = useClientManager((s) => s.activeEnvironmentName);
	const allEnvironments = useClientManager((s) => s.allEnvironmentsPreview);
	return (
		<ProjectsScreen
			key={`${environmentID}|${allEnvironments}`}
			environmentID={environmentID}
			environmentName={environmentName}
			allEnvironments={allEnvironments}
		/>
	);
}
