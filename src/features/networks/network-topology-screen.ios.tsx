import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import { ContentUnavailableView } from '@expo/ui/swift-ui';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';

import type { EnvironmentID } from '@/sdk/client/environment';
import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { TopologyDiagram } from './topology-diagram';
import { useNetworkTopology, type NetworkTopologyModel } from './use-network-topology';

function TopologyToolbar({ model }: { model: NetworkTopologyModel }) {
	const accent = useAccentColor();
	const icon = useToolbarIcons(['server.rack', 'arrow.clockwise']);
	return (
		<AppToolbar placement="right" tintColor={accent}>
			{model.allEnvironments ? (
				<Stack.Toolbar.Menu icon={icon('server.rack')} accessibilityLabel="Environment">
					{model.enabledEnvironments.map((environment) => (
						<Stack.Toolbar.MenuAction
							key={environment.id}
							isOn={environment.id === model.shownEnvironmentID}
							onPress={() => model.selectEnvironment(environment.id)}
						>
							{environment.title}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
			) : null}
			{model.isLoading && model.topology ? (
				<Stack.Toolbar.View>
					<ActivityIndicator accessibilityLabel="Refresh network topology" />
				</Stack.Toolbar.View>
			) : (
				<Stack.Toolbar.Button
					icon={icon('arrow.clockwise')}
					accessibilityLabel="Refresh network topology"
					disabled={model.isLoading}
					onPress={() => void model.loadTopology(true)}
				/>
			)}
		</AppToolbar>
	);
}

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

	let content;
	if (model.isLoading && !topology) {
		content = <Loading label="Loading network topology…" />;
	} else if (!model.hasClient && !topology) {
		content = (
			<Host style={{ flex: 1 }}>
				<ContentUnavailableView
					title="Connection Unavailable"
					systemImage="wifi.slash"
					description="Waiting for the Arcane connection to become available."
				/>
			</Host>
		);
	} else if (model.errorMessage !== undefined && !topology) {
		content = (
			<Host style={{ flex: 1 }}>
				<UnavailableView
					title="Couldn't Load Topology"
					systemImage="exclamationmark.triangle"
					description={model.errorMessage}
					actions={[{ title: 'Try Again', onPress: () => void model.loadTopology() }]}
				/>
			</Host>
		);
	} else if (topology && topology.nodes.length === 0) {
		content = (
			<Host style={{ flex: 1 }}>
				<ContentUnavailableView
					title="No Network Topology"
					systemImage="point.topleft.down.curvedto.point.bottomright.up"
					description="No network or container topology data is available for this environment."
				/>
			</Host>
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
			<Stack.Screen
				options={{
					title: 'Network Topology',
					headerLargeTitleEnabled: false,
					headerTransparent: false
				}}
			/>
			<TopologyToolbar model={model} />
			<SafeAreaView
				edges={{ bottom: true }}
				style={{ flex: 1, backgroundColor: colors.systemBackground }}
			>
				{content}
			</SafeAreaView>
		</>
	);
}
