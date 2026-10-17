import { Text, View } from 'react-native';

import type { Volume } from '@/sdk/models/volume/Volume';
import { colors, systemColors } from '@/theme/colors';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { volumeAccessibilityDescription, volumeSubtitleParts } from './volume-model';

export function UsageBadge({ text, color }: { text: string; color: string }) {
	return <Text style={[m3Type.bodyMedium, { color }]}>{text}</Text>;
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
		<View
			accessible
			accessibilityLabel={volumeAccessibilityDescription(volume, size, isPinned, environmentName)}
			style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
		>
			<RowIcon systemImage="externaldrive.fill" tint={systemColors.blue} />
			<View style={{ flex: 1, gap: 4 }}>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
					<Text style={[m3Type.bodyLarge, { color: colors.label, flexShrink: 1 }]}>
						{volume.name}
					</Text>
					{isPinned ? <Icon name="pin.fill" size={12} color={systemColors.yellow} /> : null}
				</View>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
					{volume.inUse ? (
						<UsageBadge text="In use" color={systemColors.green} />
					) : (
						<UsageBadge text="Unused" color={colors.secondaryLabel as string} />
					)}
					{subtitleParts.length > 0 ? (
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
							{subtitleParts.join(' · ')}
						</Text>
					) : null}
				</View>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</View>
		</View>
	);
}
