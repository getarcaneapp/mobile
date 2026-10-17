import { Host } from '@/ui/host';
import {
	Button,
	Label,
	LabeledContent,
	List,
	NavigationStack,
	Section,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	font,
	foregroundStyle,
	multilineTextAlignment,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';

import { capitalizedWords, connectionHasNoAddress, topologyConnections } from './topology-layout';
import { useTopologyNodePayload } from './use-network-topology';

export function TopologyNodeSheet() {
	const router = useRouter();
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const payload = useTopologyNodePayload();
	if (!payload) return null;
	const { node, topology } = payload;
	const connections = topologyConnections(node, topology);
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<List
						modifiers={[
							navigationTitle(node.name === '' ? 'Topology Node' : node.name),
							navigationBarTitleDisplayMode('inline')
						]}
					>
						<Section title="Node">
							<LabeledContent label="Type">
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{node.type === 'network' ? 'Network' : 'Container'}
								</Text>
							</LabeledContent>
							<LabeledContent label="Name">
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{node.name === '' ? '—' : node.name}
								</Text>
							</LabeledContent>
							<LabeledContent label="ID">
								<Text
									modifiers={[
										font({ textStyle: 'body', design: 'monospaced' }),
										textSelection(true),
										multilineTextAlignment('trailing')
									]}
								>
									{node.id}
								</Text>
							</LabeledContent>
						</Section>
						{node.type === 'network' ? (
							<Section title="Network Details">
								{node.metadata.driver ? (
									<LabeledContent label="Driver">
										<Text
											modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
										>
											{node.metadata.driver}
										</Text>
									</LabeledContent>
								) : null}
								{node.metadata.scope ? (
									<LabeledContent label="Scope">
										<Text
											modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
										>
											{capitalizedWords(node.metadata.scope)}
										</Text>
									</LabeledContent>
								) : null}
								<LabeledContent label="Default">
									<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
										{node.metadata.isDefault === true ? 'Yes' : 'No'}
									</Text>
								</LabeledContent>
							</Section>
						) : (
							<Section title="Container Details">
								{node.metadata.status ? (
									<LabeledContent label="Status">
										<Text
											modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
										>
											{capitalizedWords(node.metadata.status)}
										</Text>
									</LabeledContent>
								) : null}
								{node.metadata.image ? (
									<LabeledContent label="Image">
										<Text modifiers={[multilineTextAlignment('trailing'), textSelection(true)]}>
											{node.metadata.image}
										</Text>
									</LabeledContent>
								) : null}
							</Section>
						)}
						<Section title="Connections">
							{connections.length === 0 ? (
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									No connected nodes
								</Text>
							) : (
								connections.map((connection) => (
									<VStack
										key={connection.id}
										alignment="leading"
										spacing={6}
										modifiers={[padding({ vertical: 4 })]}
									>
										<Label
											title={
												connection.otherNode.name === ''
													? connection.otherNode.id
													: connection.otherNode.name
											}
											systemImage={
												connection.otherNode.type === 'network' ? 'network' : 'shippingbox'
											}
											modifiers={[font({ textStyle: 'body', weight: 'medium' })]}
										/>
										{connection.ipv4Address ? (
											<LabeledContent label="IPv4">
												<Text
													modifiers={[
														font({ textStyle: 'caption', design: 'monospaced' }),
														textSelection(true)
													]}
												>
													{connection.ipv4Address}
												</Text>
											</LabeledContent>
										) : null}
										{connection.ipv6Address ? (
											<LabeledContent label="IPv6">
												<Text
													modifiers={[
														font({ textStyle: 'caption', design: 'monospaced' }),
														textSelection(true)
													]}
												>
													{connection.ipv6Address}
												</Text>
											</LabeledContent>
										) : null}
										{connectionHasNoAddress(connection) ? (
											<Text
												modifiers={[
													font({ textStyle: 'caption' }),
													foregroundStyle({ type: 'hierarchical', style: 'secondary' })
												]}
											>
												No assigned IP address
											</Text>
										) : null}
									</VStack>
								))
							)}
						</Section>
					</List>
					<Toolbar.Content>
						<ToolbarItem placement="confirmationAction">
							<Button label="Done" onPress={() => router.back()} modifiers={toolbarSymbol} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
