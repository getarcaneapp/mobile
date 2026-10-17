import { HStack, Text, useNativeState } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	background,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	minimumScaleFactor,
	padding,
	shapes,
	strokeBorder,
	symbolEffect
} from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { withOpacity } from '@/theme/colors';
import { Motion } from '@/theme/tokens';

import { secondaryHex, useIsDark, useReduceMotion } from './accessibility';
import {
	badgePresentation,
	statusIconPresentation,
	type ResourceStatusBadgeProps
} from './resource-status';
import { hashKey, motionAwareAnimation } from './swiftui-motion';
import { symbolRenderingMode } from '../../../modules/arcane-swiftui-extras';

export function ResourceStatusBadge({
	status,
	isLive,
	usesCardStyle = false,
	label
}: ResourceStatusBadgeProps) {
	const isDark = useIsDark();
	const reduceMotion = useReduceMotion();
	const p = badgePresentation({ status, isLive, label });
	const tintHex = p.tint ?? secondaryHex[isDark ? 'dark' : 'light'];
	const pulsing = useNativeState(usesCardStyle && p.isTransitional);
	useEffect(() => {
		pulsing.value = usesCardStyle && p.isTransitional;
	}, [pulsing, usesCardStyle, p.isTransitional]);

	return (
		<HStack
			spacing={5}
			modifiers={[
				foregroundStyle(p.tint ?? 'secondary'),
				...(usesCardStyle
					? [
							padding({ horizontal: 8, vertical: 4 }),
							background(withOpacity(tintHex, p.live ? 0.16 : 0.12), shapes.capsule()),
							strokeBorder({
								color: withOpacity(tintHex, p.live ? 0.28 : 0.18),
								style: { lineWidth: 0.75 },
								shape: 'capsule'
							})
						]
					: []),
				...motionAwareAnimation(Motion.state, hashKey(p.animationKey), reduceMotion),
				accessibilityLabel(`${p.displayText} status`)
			]}
		>
			<Image
				systemName={p.icon as SFSymbol}
				modifiers={[
					font({ textStyle: 'caption', weight: 'semibold' }),
					symbolRenderingMode('hierarchical'),
					symbolEffect(
						{ effect: 'pulse' },
						{ options: { repeat: 'continuous' }, isActive: pulsing }
					),
					frame({ minWidth: 16, minHeight: 16 })
				]}
			/>
			<Text
				modifiers={
					usesCardStyle
						? [
								font({ textStyle: 'caption2', weight: 'semibold' }),
								lineLimit(1),
								minimumScaleFactor(0.8)
							]
						: [font({ textStyle: 'subheadline' })]
				}
			>
				{p.displayText}
			</Text>
		</HStack>
	);
}

export function StatusIcon({ status, isLive }: { status?: string; isLive?: boolean }) {
	const reduceMotion = useReduceMotion();
	const config = statusIconPresentation(status, isLive);
	return (
		<Image
			systemName={config.icon as SFSymbol}
			modifiers={[
				font({ textStyle: 'title3' }),
				foregroundStyle(config.color ?? 'secondary'),
				...motionAwareAnimation(Motion.state, hashKey(config.animationKey), reduceMotion),
				accessibilityLabel(`${config.label} status`)
			]}
		/>
	);
}
