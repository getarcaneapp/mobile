/** Port of `SettingsExternalRow` (SettingsRows.swift). SwiftUI-tree. */
import { HStack, Spacer } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { SettingsRow } from '@/ui/settings-row';

export function SettingsExternalRow({
	title,
	systemImage,
	color
}: {
	title: string;
	systemImage: string;
	color: string;
}) {
	return (
		<HStack>
			<SettingsRow title={title} systemImage={systemImage} color={color} titleColor="primary" />
			<Spacer />
			<Image
				systemName="arrow.up.right"
				modifiers={[
					font({ textStyle: 'footnote', weight: 'semibold' }),
					foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
				]}
			/>
		</HStack>
	);
}
