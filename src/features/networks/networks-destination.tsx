import { useLocalSearchParams } from 'expo-router';

import { useClientManager } from '@/stores/client-manager';

import { NetworkTopologyScreen } from './network-topology-screen';
import { NetworksScreen } from './networks-screen';

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

export function NetworkTopologyDestination() {
	const { envID, scoped, network } = useLocalSearchParams<{
		envID?: string;
		scoped?: string;
		network?: string;
	}>();
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const allEnvironmentsPreview = useClientManager((s) => s.allEnvironmentsPreview);
	const isScoped = scoped === '1' && envID !== undefined;
	const environmentID = isScoped ? envID : activeEnvironmentID;
	const allEnvironments = isScoped ? false : allEnvironmentsPreview;
	return (
		<NetworkTopologyScreen
			key={`${environmentID}|${allEnvironments}|${network ?? ''}`}
			environmentID={environmentID}
			allEnvironments={allEnvironments}
			focusNetworkID={isScoped ? network : undefined}
		/>
	);
}
