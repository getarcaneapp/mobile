import { useLocalSearchParams } from 'expo-router';

import { useClientManager } from '@/stores/client-manager';

import { AllVulnerabilitiesView } from './all-vulnerabilities-view';

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
