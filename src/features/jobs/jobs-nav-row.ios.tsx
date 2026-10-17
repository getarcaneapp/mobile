import { Button, HStack, Label, Spacer } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import { buttonStyle, contentShape, foregroundStyle, shapes } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { DisclosureChevron } from '@/ui/settings-row';

export function JobsNavRow({
	title,
	systemImage,
	onPress
}: {
	title: string;
	systemImage: string;
	onPress: () => void;
}) {
	const accent = useAccentColor();
	return (
		<Button onPress={onPress} modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<Label
					title={title}
					icon={
						<Image systemName={systemImage as SFSymbol} modifiers={[foregroundStyle(accent)]} />
					}
				/>
				<Spacer />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}
