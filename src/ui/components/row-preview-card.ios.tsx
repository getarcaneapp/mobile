import { HStack, Label, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	fixedSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	padding,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { CachedAsyncImageSwiftUI } from './cached-async-image-swiftui';
import type { RowPreviewCardProps } from './row-preview-card.types';
import { DashboardCardBackground, glassChipCompat } from './swiftui-surfaces';
import { symbolRenderingMode } from '../../../modules/arcane-swiftui-extras';

export function RowPreviewCard({
	icon,
	iconColor,
	iconUrl,
	title,
	subtitle,
	badges = [],
	details = []
}: RowPreviewCardProps) {
	return (
		<DashboardCardBackground>
			<VStack
				alignment="leading"
				spacing={16}
				modifiers={[padding({ all: 20 }), frame({ width: 320 })]}
			>
				<HStack spacing={14}>
					<CachedAsyncImageSwiftUI
						url={iconUrl}
						size={52}
						fallback={
							<Image
								systemName={icon as SFSymbol}
								modifiers={[
									font({ textStyle: 'title' }),
									symbolRenderingMode('hierarchical'),
									foregroundStyle('white'),
									frame({ width: 52, height: 52 }),
									glassChipCompat({ tint: iconColor, shape: 'circle' })
								]}
							/>
						}
					/>
					<VStack alignment="leading" spacing={4}>
						<Text
							modifiers={[
								font({ textStyle: 'title3', weight: 'semibold' }),
								lineLimit(1),
								truncationMode('middle')
							]}
						>
							{title}
						</Text>
						{subtitle ? (
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
									lineLimit(2)
								]}
							>
								{subtitle}
							</Text>
						) : null}
						{badges.length > 0 ? (
							<HStack spacing={6} modifiers={[padding({ top: 2 })]}>
								{badges.map((badge) => (
									<Text
										key={`${badge.text}-${badge.color}`}
										modifiers={[
											font({ textStyle: 'caption2', weight: 'semibold' }),
											padding({ horizontal: 8, vertical: 3 }),
											foregroundStyle('white'),
											glassChipCompat({ tint: badge.color, shape: 'capsule' })
										]}
									>
										{badge.text}
									</Text>
								))}
							</HStack>
						) : null}
					</VStack>
					<Spacer minLength={0} />
				</HStack>
				{details.length > 0 ? (
					<VStack alignment="leading" spacing={12}>
						{details.map((detail) => (
							<VStack key={`${detail.label}-${detail.value}`} alignment="leading" spacing={4}>
								<Label
									title={detail.label}
									systemImage={detail.icon as SFSymbol}
									modifiers={[
										font({ textStyle: 'caption', weight: 'semibold' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' })
									]}
								/>
								<Text
									modifiers={[
										detail.monospaced
											? font({ textStyle: 'caption', design: 'monospaced' })
											: font({ textStyle: 'subheadline' }),
										foregroundStyle('primary'),
										fixedSize({ horizontal: false, vertical: true })
									]}
								>
									{detail.value}
								</Text>
							</VStack>
						))}
					</VStack>
				) : null}
			</VStack>
		</DashboardCardBackground>
	);
}
