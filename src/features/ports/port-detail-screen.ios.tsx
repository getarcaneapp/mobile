import { Host } from '@/ui/host';
import { LabeledContent, List, Section, Text } from '@expo/ui/swift-ui';
import {
	font,
	foregroundStyle,
	lineLimit,
	listStyle,
	textSelection,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { usePortDetail } from './use-port-detail';

function Value({ label, value }: { label: string; value: string }) {
	return (
		<LabeledContent label={label}>
			<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
				{value}
			</Text>
		</LabeledContent>
	);
}

export function PortDetailScreen() {
	const { port, hostString } = usePortDetail();
	if (!port) return <Stack.Screen options={{ title: '' }} />;
	return (
		<>
			<Stack.Screen options={{ title: port.containerName, headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					<Section title="Mapping">
						{port.hostPort !== undefined ? (
							<>
								<LabeledContent label="Host">
									<Text
										modifiers={[
											font({ textStyle: 'subheadline', design: 'monospaced' }),
											textSelection(true)
										]}
									>
										{hostString}
									</Text>
								</LabeledContent>
								<Value label="Host Port" value={String(port.hostPort)} />
							</>
						) : (
							<Value label="Exposure" value="Internal only" />
						)}
						<Value label="Container Port" value={String(port.containerPort)} />
						<Value label="Protocol" value={port.protocolName.toUpperCase()} />
						<Value label="Published" value={port.isPublished ? 'Yes' : 'No'} />
					</Section>
					<Section title="Container">
						<Value label="Name" value={port.containerName} />
						<LabeledContent label="ID">
							<Text
								modifiers={[
									font({ textStyle: 'caption', design: 'monospaced' }),
									lineLimit(1),
									truncationMode('middle'),
									textSelection(true)
								]}
							>
								{port.containerId}
							</Text>
						</LabeledContent>
					</Section>
				</List>
			</Host>
		</>
	);
}
