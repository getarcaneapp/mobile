import { useLocalSearchParams } from 'expo-router';

import { useClientManager } from '@/stores/client-manager';

import { NetworkTopologyScreen } from './network-topology-screen';
import { NetworksScreen } from './networks-screen';

/**
 * `appTabDestination(.networks)`: the list for the active environment, or
 * every enabled environment with the All Environments preview. Re-keyed on
 * the environment so switching starts a fresh list.
 */
export function NetworksDestination() {
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const environmentName = useClientManager((s) => s.activeEnvironmentName);
	const allEnvironments = useClientManager((s) => s.allEnvironmentsPreview);
	return (
		<NetworksScreen
			key={`${environmentID}|${allEnvironments}`}
			environmentID={environmentID}
			environmentName={environmentName}
			allEnvironments={allEnvironments}
		/>
	);
}

/**
 * `appTabDestination(.networkTopology)`, or `NetworkTopologyView(environmentID:)`
 * pushed from a network's detail (`?envID=…&scoped=1`).
 */
export function NetworkTopologyDestination() {
	const { envID, scoped } = useLocalSearchParams<{ envID?: string; scoped?: string }>();
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const allEnvironmentsPreview = useClientManager((s) => s.allEnvironmentsPreview);
	const isScoped = scoped === '1' && envID !== undefined;
	const environmentID = isScoped ? envID : activeEnvironmentID;
	const allEnvironments = isScoped ? false : allEnvironmentsPreview;
	return (
		<NetworkTopologyScreen
			key={`${environmentID}|${allEnvironments}`}
			environmentID={environmentID}
			allEnvironments={allEnvironments}
		/>
	);
}
