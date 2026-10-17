import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { StatusIcon } from '@/ui/components/resource-status-badge';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, ValueRow } from '@/features/containers/android-material';
import { AndroidResourceActionsToolbar } from '@/features/containers/android-toolbar';
import { containerDisplayName, containerIsRunning } from '@/features/containers/container-model';

import { LinkItem } from './android-rows';
import { useVolumeDetail, type VolumeDetailModel } from './use-volume-detail';

function ConsumersSection({ model }: { model: VolumeDetailModel }) {
	const ids = model.volume.containers;
	return (
		<M3Section title={`Consumers (${ids.length})`}>
			{ids.map((containerID) => {
				const container = model.resolvedContainer(containerID);
				if (!container)
					return (
						<ValueRow
							key={containerID}
							title="Unavailable container"
							value={containerID}
							monospaced
						/>
					);
				return (
					<Pressable
						key={containerID}
						onPress={() => model.openContainer(container)}
						accessibilityRole="button"
						android_ripple={{ color: colors.separator as string }}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 12,
							minHeight: 56,
							paddingHorizontal: 16,
							paddingVertical: 8
						}}
					>
						<StatusIcon status={container.status} isLive={containerIsRunning(container)} />
						<View style={{ flex: 1 }}>
							<Text style={[m3Type.titleMedium, { color: colors.label }]}>
								{containerDisplayName(container)}
							</Text>
							<Text
								style={[m3Type.bodySmall, { color: colors.secondaryLabel, fontFamily: monoFamily }]}
								numberOfLines={1}
							>
								{containerID}
							</Text>
						</View>
						<Icon name="chevron.right" size={16} color={colors.secondaryLabel} />
					</Pressable>
				);
			})}
		</M3Section>
	);
}

export function VolumeDetailScreen() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const model = useVolumeDetail(envID, name);
	const { volume } = model;

	return (
		<>
			<Stack.Screen options={{ title: volume.name }} />
			<AndroidResourceActionsToolbar
				primary={model.toolbar.primary}
				secondary={model.toolbar.secondary}
				overflow={model.toolbar.overflow}
				resourceName={volume.name}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }}>
						<Icon name="externaldrive.fill" size={24} color={systemColors.orange} />
						<View style={{ flex: 1 }}>
							<Text style={[m3Type.titleMedium, { color: colors.label }]}>{volume.name}</Text>
							<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
								{volume.driver}
							</Text>
						</View>
					</View>
				</M3Section>
				<M3Section title="Details">
					{model.metadata.map((item) => (
						<ValueRow key={item.label} title={item.label} value={item.value} />
					))}
					{volume.mountpoint !== '' ? (
						<ValueRow title="Mount Point" value={volume.mountpoint} monospaced />
					) : null}
					<LinkItem title="Browse Files" icon="folder" onPress={model.openBrowse} />
					<LinkItem title="Backups" icon="clock.arrow.circlepath" onPress={model.openBackups} />
				</M3Section>
				{volume.containers.length > 0 ? <ConsumersSection model={model} /> : null}
				{model.sortedLabels.length > 0 ? (
					<M3Section title="Labels">
						{model.sortedLabels.map((key) => (
							<ValueRow key={key} title={key} value={volume.labels[key] ?? ''} monospaced />
						))}
					</M3Section>
				) : null}
				{model.sortedOptions.length > 0 ? (
					<M3Section title="Options">
						{model.sortedOptions.map((key) => (
							<ValueRow key={key} title={key} value={volume.options[key] ?? ''} monospaced />
						))}
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}
