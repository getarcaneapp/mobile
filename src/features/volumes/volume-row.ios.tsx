import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	font,
	foregroundStyle
} from '@expo/ui/swift-ui/modifiers';

import type { Volume } from '@/sdk/models/volume/Volume';
import { systemColors } from '@/theme/colors';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { RowIcon } from '@/ui/components/row-icon';

import { volumeAccessibilityDescription, volumeSubtitleParts } from './volume-model';

export function UsageBadge({ text, color }: { text: string; color: string }) {
	return (
		<Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(color)]}>{text}</Text>
	);
}

export function VolumeRow({
	volume,
	size,
	isPinned = false,
	environmentName,
	environmentColor
}: {
	volume: Volume;
	size?: number;
	isPinned?: boolean;
	environmentName?: string;
	environmentColor?: string;
}) {
	const subtitleParts = volumeSubtitleParts(volume, size);
	return (
		<HStack
			spacing={12}
			modifiers={[
				accessibilityElement('combine'),
				accessibilityLabel(volumeAccessibilityDescription(volume, size, isPinned, environmentName))
			]}
		>
			<RowIcon systemImage="externaldrive.fill" tint={systemColors.blue} />
			<VStack alignment="leading" spacing={4}>
				<HStack spacing={6}>
					<Text modifiers={[font({ textStyle: 'body' })]}>{volume.name}</Text>
					{isPinned ? (
						<Image
							systemName="pin.fill"
							modifiers={[
								font({ textStyle: 'caption2' }),
								foregroundStyle(systemColors.yellow),
								accessibilityHidden(true)
							]}
						/>
					) : null}
				</HStack>
				<HStack spacing={6}>
					{volume.inUse ? (
						<UsageBadge text="In use" color={systemColors.green} />
					) : (
						<UsageBadge text="Unused" color="secondary" />
					)}
					{subtitleParts.length > 0 ? (
						<Text
							modifiers={[
								font({ textStyle: 'subheadline' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{subtitleParts.join(' · ')}
						</Text>
					) : null}
				</HStack>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</VStack>
		</HStack>
	);
}
