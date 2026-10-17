import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	font,
	foregroundStyle,
	frame,
	lineLimit,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { colors } from '@/theme/colors';

type SettingsRowProps = {
	title: string;
	subtitle?: string;
	systemImage: string;
	color: string;
	titleColor?: string;
};

export function SettingsRow({ title, subtitle, systemImage, color, titleColor }: SettingsRowProps) {
	return (
		<HStack spacing={12}>
			<Image
				systemName={systemImage as SFSymbol}
				modifiers={[foregroundStyle(color), frame({ width: 28 })]}
			/>
			<VStack alignment="leading" spacing={2}>
				<Text modifiers={[foregroundStyle(titleColor ?? 'primary')]}>{title}</Text>
				{subtitle ? (
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							lineLimit(),
							truncationMode('middle')
						]}
					>
						{subtitle}
					</Text>
				) : null}
			</VStack>
		</HStack>
	);
}

export function DisclosureChevron() {
	return (
		<Image
			systemName="chevron.right"
			modifiers={[
				font({ textStyle: 'footnote', weight: 'semibold' }),
				foregroundStyle(colors.tertiaryLabel)
			]}
		/>
	);
}

export { Spacer };
