import { HStack, Text } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	background,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	padding,
	shapes,
	symbolEffect,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { useNativeState } from '@expo/ui/swift-ui';
import { useEffect } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';

import { imageReferenceParts, type ImageReferenceParts } from './image-reference';
import type { RowIconProps, TextStyleName } from './row-icon.types';

function iconModifiers(color: string, size: number) {
	return {
		glyph: [font({ size: size * 0.46, weight: 'semibold' }), foregroundStyle(color)],
		tile: [
			frame({ width: size, height: size }),
			background(
				withOpacity(color, 0.14),
				shapes.roundedRectangle({ cornerRadius: Radius.small, roundedCornerStyle: 'continuous' })
			),
			accessibilityHidden(true)
		]
	};
}

function BouncingRowIcon({
	systemImage,
	color,
	size,
	changeToken
}: {
	systemImage: string;
	color: string;
	size: number;
	changeToken: string;
}) {
	const bounce = useNativeState<string>(changeToken);
	useEffect(() => {
		bounce.set(changeToken);
	}, [bounce, changeToken]);
	const { glyph, tile } = iconModifiers(color, size);
	return (
		<Image
			systemName={systemImage as SFSymbol}
			modifiers={[...glyph, symbolEffect({ effect: 'bounce' }, { value: bounce }), ...tile]}
		/>
	);
}

export function RowIcon({
	systemImage,
	tint,
	size = 36,
	changeToken,
	identity
}: RowIconProps & { identity?: string }) {
	const accent = useAccentColor();
	const color = tint ?? accent;
	if (changeToken !== undefined) {
		return (
			<BouncingRowIcon
				key={identity}
				systemImage={systemImage}
				color={color}
				size={size}
				changeToken={changeToken}
			/>
		);
	}
	const { glyph, tile } = iconModifiers(color, size);
	return <Image systemName={systemImage as SFSymbol} modifiers={[...glyph, ...tile]} />;
}

export function ImageReferenceName({
	reference,
	textStyle = 'body'
}: {
	reference: ImageReferenceParts;
	textStyle?: TextStyleName;
}) {
	return (
		<Text modifiers={[font({ textStyle })]}>
			<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
				{reference.namespace}
			</Text>
			<Text>{reference.name}</Text>
		</Text>
	);
}

export function ImageReferenceLine({ reference }: { reference: string }) {
	const parts = imageReferenceParts(reference);
	return (
		<HStack spacing={6} modifiers={[accessibilityElement('ignore'), accessibilityLabel(reference)]}>
			<Text modifiers={[font({ textStyle: 'caption' }), lineLimit(1), truncationMode('head')]}>
				<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
					{parts.namespace}
				</Text>
				<Text>{parts.name}</Text>
			</Text>
			{parts.tag ? <TagChip text={parts.tag} /> : null}
		</HStack>
	);
}

export function TagChip({ text }: { text: string }) {
	return (
		<Text
			modifiers={[
				font({ textStyle: 'caption', design: 'monospaced' }),
				foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
				lineLimit(1),
				padding({ horizontal: 6, vertical: 2 }),
				background(
					'#8E8E931F',
					shapes.roundedRectangle({ cornerRadius: Radius.small, roundedCornerStyle: 'continuous' })
				)
			]}
		>
			{text}
		</Text>
	);
}
