/**
 * Ports of `RowIcon`, `ImageReferenceName`, `ImageReferenceLine` and
 * `TagChip` (RowIcon.swift).
 *
 * SwiftUI-tree.
 */
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

/** Leading symbol for list rows: a tinted glyph on a soft rounded-square well. */
export function RowIcon({ systemImage, tint, size = 36, changeToken = '' }: RowIconProps) {
	const accent = useAccentColor();
	const color = tint ?? accent;
	const bounce = useNativeState<string>(changeToken);
	useEffect(() => {
		bounce.value = changeToken;
	}, [bounce, changeToken]);
	return (
		<Image
			systemName={systemImage as SFSymbol}
			modifiers={[
				font({ size: size * 0.46, weight: 'semibold' }),
				foregroundStyle(color),
				symbolEffect({ effect: 'bounce' }, { value: bounce }),
				frame({ width: size, height: size }),
				background(
					withOpacity(color, 0.14),
					shapes.roundedRectangle({ cornerRadius: Radius.small, roundedCornerStyle: 'continuous' })
				),
				accessibilityHidden(true)
			]}
		/>
	);
}

/** An image reference with its namespace dimmed so the image's own name leads. */
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

/** Secondary line naming a row's image: caption-size reference with its tag as a chip. */
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

/** Small monospaced chip for tags, versions, and other literal identifiers. */
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
