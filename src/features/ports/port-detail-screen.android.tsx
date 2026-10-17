import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { colors } from '@/theme/colors';

import { M3Section, ValueRow } from '@/features/containers/android-material';
import { LabeledRow, MonoText } from '@/features/networks/android-parts';

import { usePortDetail } from './use-port-detail';

export function PortDetailScreen() {
	const { port, hostString } = usePortDetail();
	if (!port) return <Stack.Screen options={{ title: '' }} />;
	return (
		<>
			<Stack.Screen options={{ title: port.containerName }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section title="Mapping">
					{port.hostPort !== undefined ? (
						<>
							<ValueRow title="Host" value={hostString} monospaced />
							<ValueRow title="Host Port" value={String(port.hostPort)} />
						</>
					) : (
						<ValueRow title="Exposure" value="Internal only" />
					)}
					<ValueRow title="Container Port" value={String(port.containerPort)} />
					<ValueRow title="Protocol" value={port.protocolName.toUpperCase()} />
					<ValueRow title="Published" value={port.isPublished ? 'Yes' : 'No'} />
				</M3Section>
				<M3Section title="Container">
					<ValueRow title="Name" value={port.containerName} />
					<LabeledRow title="ID">
						<MonoText value={port.containerId} size={12} lines={1} />
					</LabeledRow>
				</M3Section>
			</ScrollView>
		</>
	);
}
