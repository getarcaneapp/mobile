import { Button, HStack, Label, Spacer, Text } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	buttonStyle,
	contentShape,
	foregroundStyle,
	frame,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { DisclosureChevron } from '@/ui/settings-row';

export function NavigationRow({ onPress, children }: { onPress: () => void; children: ReactNode }) {
	return (
		<Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
			<HStack
				modifiers={[
					frame({ maxWidth: Infinity, alignment: 'leading' }),
					contentShape(shapes.rectangle())
				]}
			>
				{children}
				<Spacer />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}

export function NavigationLabelRow({
	title,
	systemImage,
	onPress
}: {
	title: string;
	systemImage: SFSymbol;
	onPress: () => void;
}) {
	return (
		<NavigationRow onPress={onPress}>
			<AccentLabel systemImage={systemImage}>
				<Text>{title}</Text>
			</AccentLabel>
		</NavigationRow>
	);
}

export function NavigationTextRow({ title, onPress }: { title: string; onPress: () => void }) {
	return (
		<NavigationRow onPress={onPress}>
			<Text>{title}</Text>
		</NavigationRow>
	);
}

export function AccentLabel({
	systemImage,
	children
}: {
	systemImage: SFSymbol;
	children: ReactNode;
}) {
	const accent = useAccentColor();
	return (
		<Label icon={<Image systemName={systemImage} modifiers={[foregroundStyle(accent)]} />}>
			{children}
		</Label>
	);
}

export function RedText({ children }: { children: string }) {
	return <Text modifiers={[foregroundStyle(systemColors.red)]}>{children}</Text>;
}

export function ErrorRetryRows({
	message,
	onRetry
}: {
	message: string | undefined;
	onRetry: () => void;
}) {
	if (message === undefined) return null;
	return (
		<>
			<RedText>{message}</RedText>
			<Button label="Retry" onPress={onRetry} />
		</>
	);
}
