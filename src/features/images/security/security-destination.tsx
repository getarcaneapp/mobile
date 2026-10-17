import { useLocalSearchParams } from 'expo-router';

import { useClientManager } from '@/stores/client-manager';

import { AllVulnerabilitiesView } from './all-vulnerabilities-view';

/**
 * `appTabDestination(.imageVulnerabilities)`: AllVulnerabilitiesView for the
 * active environment (or the `envID` a pushing screen passed, e.g. the
 * Dashboard's `imageVulnerabilities?envID=…`), with the All Environments
 * preview. Re-keyed on the environment so switching starts fresh
 * (Swift `.task(id: environmentID)`).
 */
export function SecurityDestination() {
	const { envID } = useLocalSearchParams<{ envID?: string }>();
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const allEnvironments = useClientManager((s) => s.allEnvironmentsPreview);
	const environmentID = envID ?? activeEnvironmentID;
	return (
		<AllVulnerabilitiesView
			key={`${environmentID}|${allEnvironments}`}
			environmentID={environmentID}
			allEnvironments={allEnvironments}
		/>
	);
}
