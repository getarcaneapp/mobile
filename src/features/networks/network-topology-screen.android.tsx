/** Android rendering of `NetworkTopologyView` (NetworkTopologyView.swift). */
import { Stack } from 'expo-router';
import { View } from 'react-native';

import type { EnvironmentID } from '@/sdk/client/environment';
import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';

import { CenteredMessage } from '@/features/containers/android-material';
import { AndroidToolbar, type AndroidToolbarItem } from '@/features/containers/android-toolbar';

import { TopologyDiagram } from './topology-diagram';
import { useNetworkTopology } from './use-network-topology';

function Loading({ label }: { label: string }) {
	return (
		<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
			<ArcaneLoadingView label={label} />
		</View>
	);
}

export function NetworkTopologyScreen({
	environmentID,
	allEnvironments
}: {
	environmentID: EnvironmentID;
	allEnvironments: boolean;
}) {
	const model = useNetworkTopology({ environmentID, allEnvironments });
	const { topology, layout } = model;

	const items: AndroidToolbarItem[] = [];
	if (model.allEnvironments) {
		items.push({
			kind: 'menu',
			id: 'environment',
			icon: 'server.rack',
			label: 'Environment',
			items: model.enabledEnvironments.map((environment) => ({
				id: environment.id,
				title: environment.title,
				checked: environment.id === model.shownEnvironmentID,
				onPress: () => model.selectEnvironment(environment.id)
			}))
		});
	}
	items.push(
		model.isLoading && topology
			? { kind: 'spinner', id: 'refresh', label: 'Refresh network topology' }
			: {
					kind: 'button',
					id: 'refresh',
					icon: 'arrow.clockwise',
					label: 'Refresh network topology',
					disabled: model.isLoading,
					onPress: () => void model.loadTopology(true)
				}
	);

	let content;
	if (model.isLoading && !topology) {
		content = <Loading label="Loading network topology…" />;
	} else if (!model.hasClient && !topology) {
		content = (
			<CenteredMessage
				icon="wifi.slash"
				title="Connection Unavailable"
				message="Waiting for the Arcane connection to become available."
			/>
		);
	} else if (model.errorMessage !== undefined && !topology) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Topology"
				message={model.errorMessage}
				action={{ title: 'Try Again', onPress: () => void model.loadTopology() }}
			/>
		);
	} else if (topology && topology.nodes.length === 0) {
		content = (
			<CenteredMessage
				icon="point.topleft.down.curvedto.point.bottomright.up"
				title="No Network Topology"
				message="No network or container topology data is available for this environment."
			/>
		);
	} else if (layout) {
		content = (
			<TopologyDiagram
				key={model.layoutRevision}
				graph={layout}
				revision={model.layoutRevision}
				onSelect={model.selectNode}
			/>
		);
	} else {
		content = <Loading label="Preparing network topology…" />;
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Network Topology' }} />
			<AndroidToolbar items={items} />
			<View style={{ flex: 1, backgroundColor: colors.systemBackground }}>{content}</View>
		</>
	);
}
