import { Stack, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, ValueRow } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';

import { MonoText, SecondaryText } from './android-parts';
import { capitalizedWords, connectionHasNoAddress, topologyConnections } from './topology-layout';
import { useTopologyNodePayload } from './use-network-topology';

export function TopologyNodeSheet() {
	const router = useRouter();
	const payload = useTopologyNodePayload();
	if (!payload) return null;
	const { node, topology } = payload;
	const connections = topologyConnections(node, topology);
	return (
		<>
			<Stack.Screen options={{ title: node.name === '' ? 'Topology Node' : node.name }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'done',
						icon: 'checkmark',
						label: 'Done',
						onPress: () => router.back()
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section title="Node">
					<ValueRow title="Type" value={node.type === 'network' ? 'Network' : 'Container'} />
					<ValueRow title="Name" value={node.name === '' ? '—' : node.name} />
					<ValueRow title="ID" value={node.id} monospaced />
				</M3Section>
				{node.type === 'network' ? (
					<M3Section title="Network Details">
						{node.metadata.driver ? <ValueRow title="Driver" value={node.metadata.driver} /> : null}
						{node.metadata.scope ? (
							<ValueRow title="Scope" value={capitalizedWords(node.metadata.scope)} />
						) : null}
						<ValueRow title="Default" value={node.metadata.isDefault === true ? 'Yes' : 'No'} />
					</M3Section>
				) : (
					<M3Section title="Container Details">
						{node.metadata.status ? (
							<ValueRow title="Status" value={capitalizedWords(node.metadata.status)} />
						) : null}
						{node.metadata.image ? <ValueRow title="Image" value={node.metadata.image} /> : null}
					</M3Section>
				)}
				<M3Section title="Connections">
					{connections.length === 0 ? (
						<SecondaryText text="No connected nodes" />
					) : (
						connections.map((connection) => (
							<View
								key={connection.id}
								style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}
							>
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
									<Icon
										name={connection.otherNode.type === 'network' ? 'network' : 'shippingbox'}
										size={20}
										color={colors.secondaryLabel}
									/>
									<Text style={[m3Type.titleMedium, { color: colors.label, flex: 1 }]}>
										{connection.otherNode.name === ''
											? connection.otherNode.id
											: connection.otherNode.name}
									</Text>
								</View>
								{connection.ipv4Address ? (
									<View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
										<Text style={[m3Type.bodyMedium, { color: colors.label }]}>IPv4</Text>
										<MonoText value={connection.ipv4Address} size={12} />
									</View>
								) : null}
								{connection.ipv6Address ? (
									<View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
										<Text style={[m3Type.bodyMedium, { color: colors.label }]}>IPv6</Text>
										<MonoText value={connection.ipv6Address} size={12} />
									</View>
								) : null}
								{connectionHasNoAddress(connection) ? (
									<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
										No assigned IP address
									</Text>
								) : null}
							</View>
						))
					)}
				</M3Section>
			</ScrollView>
		</>
	);
}
