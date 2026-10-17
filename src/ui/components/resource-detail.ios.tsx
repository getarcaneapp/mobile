/**
 * Ports of `AdaptiveMetadataGrid`, `MonospacedValue` and `PartialDataNotice`
 * (ResourceDetailComponents.swift).
 *
 * SwiftUI-tree.
 */
import { Grid, HStack, Label, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	onGeometryChange,
	padding,
	textSelection,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import {
	adaptiveColumns,
	chunk,
	metadataAccessibilityLabel,
	metadataItemID,
	type ResourceMetadataItem
} from './resource-detail.types';

/**
 * Adaptive (min 145pt) grid of labeled values. @expo/ui has no `LazyVGrid`,
 * so the column count is derived from the measured width.
 */
export function AdaptiveMetadataGrid({ items }: { items: ResourceMetadataItem[] }) {
	const [width, setWidth] = useState(0);
	const columns = width > 0 ? adaptiveColumns(width) : 2;
	return (
		<Grid
			alignment="topLeading"
			horizontalSpacing={8}
			verticalSpacing={14}
			modifiers={[
				frame({ maxWidth: Infinity, alignment: 'leading' }),
				onGeometryChange((size) => setWidth(size.width)),
				padding({ vertical: 4 })
			]}
		>
			{chunk(items, columns).map((row, rowIndex) => (
				<Grid.Row key={rowIndex}>
					{row.map((item) => (
						<HStack
							key={metadataItemID(item)}
							alignment="top"
							spacing={9}
							modifiers={[
								frame({ maxWidth: Infinity, alignment: 'leading' }),
								accessibilityElement('ignore'),
								accessibilityLabel(metadataAccessibilityLabel(item))
							]}
						>
							<Image
								systemName={item.systemImage as SFSymbol}
								modifiers={[
									foregroundStyle(item.tint ?? 'secondary'),
									frame({ width: 22 }),
									accessibilityHidden(true)
								]}
							/>
							<VStack alignment="leading" spacing={2}>
								<Text
									modifiers={[
										font({ textStyle: 'caption' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' })
									]}
								>
									{item.label}
								</Text>
								<Text
									modifiers={[
										font({
											textStyle: 'subheadline',
											weight: 'semibold',
											design: item.monospaced ? 'monospaced' : 'default'
										}),
										...(item.monospaced ? [textSelection(true)] : []),
										lineLimit(2)
									]}
								>
									{item.value}
								</Text>
								{item.status ? (
									<Text
										modifiers={[
											font({ textStyle: 'caption2' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' })
										]}
									>
										{item.status}
									</Text>
								) : null}
							</VStack>
						</HStack>
					))}
				</Grid.Row>
			))}
		</Grid>
	);
}

export function MonospacedValue({
	value,
	lineLimit: limit
}: {
	value: string;
	lineLimit?: number;
}) {
	return (
		<Text
			modifiers={[
				font({ textStyle: 'callout', design: 'monospaced' }),
				textSelection(true),
				...(limit !== undefined ? [lineLimit(limit)] : []),
				truncationMode('middle')
			]}
		>
			{value}
		</Text>
	);
}

export function PartialDataNotice({ message }: { message: string }) {
	return (
		<Label
			title={message}
			systemImage="exclamationmark.triangle"
			modifiers={[
				font({ textStyle: 'callout' }),
				foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
				accessibilityElement('combine')
			]}
		/>
	);
}
