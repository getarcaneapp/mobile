/**
 * Port of `ImageRow` (ImagesView.swift).
 *
 * SwiftUI-tree.
 */
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
	accessibilityElement,
	fixedSize,
	font,
	foregroundStyle,
	padding
} from '@expo/ui/swift-ui/modifiers';

import { useWindowDimensions } from 'react-native';

import { systemColors } from '@/theme/colors';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { imageReferenceParts } from '@/ui/components/image-reference';
import { UpdateStateBadge } from '@/ui/components/labels';
import { updateStatePresentation } from '@/ui/components/labels.types';
import { ImageReferenceName, RowIcon, TagChip } from '@/ui/components/row-icon';

import type { ImageRowModel } from './use-images-list';

function ImageRowDetails({ tag, row }: { tag: string | undefined; row: ImageRowModel }) {
	return (
		<>
			<HStack spacing={8}>
				{tag ? <TagChip text={tag} /> : null}
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						fixedSize()
					]}
				>
					{row.sizeText}
				</Text>
			</HStack>
			<UpdateStateBadge state={row.updateState} />
		</>
	);
}

/**
 * Stand-in for Swift's `ViewThatFits(in: .horizontal) { HStack { details } VStack { details } }`
 * (@expo/ui has no ViewThatFits): estimates the one-line width from glyph metrics measured
 * against the reference app (caption-mono chip, subheadline size, badge) and the row's text
 * column (inset-grouped margins, 36pt icon + 12pt spacing, disclosure chevron).
 */
function detailsFitOneLine(tag: string | undefined, row: ImageRowModel, windowWidth: number) {
	const available = windowWidth - 32 - 64 - 47;
	const chip = tag ? 12 + 7.25 * tag.length + 8 : 0;
	const size = 7.5 * row.sizeText.length;
	const badge = 20 + 7.1 * updateStatePresentation(row.updateState).title.length;
	return chip + size + 8 + badge <= available;
}

export function ImageRow({
	row,
	environmentName,
	environmentColor
}: {
	row: ImageRowModel;
	environmentName?: string;
	environmentColor?: string;
}) {
	const { width } = useWindowDimensions();
	const reference = imageReferenceParts(row.displayName);
	return (
		<HStack spacing={12} modifiers={[padding({ vertical: 2 }), accessibilityElement('combine')]}>
			<RowIcon systemImage="square.3.layers.3d.top.filled" tint={systemColors.purple} />
			<VStack alignment="leading" spacing={5}>
				<ImageReferenceName reference={reference} />
				{detailsFitOneLine(reference.tag, row, width) ? (
					<HStack spacing={8}>
						<ImageRowDetails tag={reference.tag} row={row} />
					</HStack>
				) : (
					<VStack alignment="leading" spacing={5}>
						<ImageRowDetails tag={reference.tag} row={row} />
					</VStack>
				)}
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</VStack>
			<Spacer minLength={0} />
		</HStack>
	);
}
