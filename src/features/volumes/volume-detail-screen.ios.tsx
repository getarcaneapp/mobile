import { Host } from '@/ui/host';
import {
	Button,
	HStack,
	Label,
	LabeledContent,
	List,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	listStyle,
	shapes,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import { systemColors } from '@/theme/colors';
import { MonospacedValue } from '@/ui/components/resource-detail';
import { StatusIcon } from '@/ui/components/resource-status-badge';
import { ResourceActionsToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

import { containerDisplayName, containerIsRunning } from '@/features/containers/container-model';
import { LinkRow } from '@/features/containers/container-sections';

import { useVolumeDetail, type VolumeDetailModel } from './use-volume-detail';

function ConsumersSection({ model }: { model: VolumeDetailModel }) {
	const ids = model.volume.containers;
	return (
		<Section header={<Text>{`Consumers (${ids.length})`}</Text>}>
			{ids.map((containerID) => {
				const container = model.resolvedContainer(containerID);
				if (!container) {
					return (
						<LabeledContent key={containerID} label="Unavailable container">
							<MonospacedValue value={containerID} />
						</LabeledContent>
					);
				}
				return (
					<Button
						key={containerID}
						onPress={() => model.openContainer(container)}
						modifiers={[buttonStyle('plain')]}
					>
						<HStack modifiers={[contentShape(shapes.rectangle())]}>
							<StatusIcon status={container.status} isLive={containerIsRunning(container)} />
							<VStack alignment="leading">
								<Text modifiers={[font({ textStyle: 'headline' })]}>
									{containerDisplayName(container)}
								</Text>
								<Text
									modifiers={[
										font({ textStyle: 'caption', design: 'monospaced' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' })
									]}
								>
									{containerID}
								</Text>
							</VStack>
							<Spacer />
							<DisclosureChevron />
						</HStack>
					</Button>
				);
			})}
		</Section>
	);
}

function KeyValueSection({
	title,
	keys,
	values
}: {
	title: string;
	keys: string[];
	values: Record<string, string>;
}) {
	if (keys.length === 0) return null;
	return (
		<Section title={title}>
			{keys.map((key) => (
				<LabeledContent key={key} label={key}>
					<Text
						modifiers={[font({ textStyle: 'body', design: 'monospaced' }), textSelection(true)]}
					>
						{values[key] ?? ''}
					</Text>
				</LabeledContent>
			))}
		</Section>
	);
}

export function VolumeDetailScreen() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const model = useVolumeDetail(envID, name);
	const { volume } = model;

	return (
		<>
			<Stack.Screen options={{ title: volume.name, headerLargeTitleEnabled: false }} />
			<ResourceActionsToolbar
				primary={model.toolbar.primary}
				secondary={model.toolbar.secondary}
				overflow={model.toolbar.overflow}
				resourceName={volume.name}
			/>
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					<Section>
						<Label
							icon={
								<Image
									systemName="externaldrive.fill"
									modifiers={[foregroundStyle(systemColors.orange)]}
								/>
							}
						>
							<VStack alignment="leading">
								<Text modifiers={[font({ textStyle: 'headline' })]}>{volume.name}</Text>
								<Text
									modifiers={[
										font({ textStyle: 'subheadline' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' })
									]}
								>
									{volume.driver}
								</Text>
							</VStack>
						</Label>
					</Section>
					<Section title="Details">
						{model.metadata.map((item) => (
							<LabeledContent key={item.label} label={item.label}>
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{item.value}
								</Text>
							</LabeledContent>
						))}
						{volume.mountpoint !== '' ? (
							<LabeledContent label="Mount Point">
								<MonospacedValue value={volume.mountpoint} />
							</LabeledContent>
						) : null}
						<LinkRow title="Browse Files" systemImage="folder" onPress={model.openBrowse} />
						<LinkRow
							title="Backups"
							systemImage="clock.arrow.circlepath"
							onPress={model.openBackups}
						/>
					</Section>
					{volume.containers.length > 0 ? <ConsumersSection model={model} /> : null}
					<KeyValueSection title="Labels" keys={model.sortedLabels} values={volume.labels} />
					<KeyValueSection title="Options" keys={model.sortedOptions} values={volume.options} />
				</List>
			</Host>
		</>
	);
}
