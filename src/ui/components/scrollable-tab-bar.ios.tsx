import { Host } from '@/ui/host';
import { Button, HStack, ScrollView, Text, useNativeState } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityAddTraits,
	accessibilityElement,
	accessibilityLabel,
	background,
	defaultScrollAnchorForRole,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	id,
	lineLimit,
	padding,
	scrollPosition,
	scrollTargetLayout,
	shapes,
	strokeBorder
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useEffect } from 'react';

import { useAccentColor } from '@/theme/accent';
import { colors, withOpacity } from '@/theme/colors';
import { Motion, Radius } from '@/theme/tokens';

import { useReduceMotion } from './accessibility';
import type { ScrollableTabBarProps } from './scrollable-tab-bar.types';
import { motionAwareAnimation, pressableButtonStyle } from './swiftui-motion';

export function ScrollableTabBar<Selection extends string>(
	props: ScrollableTabBarProps<Selection>
) {
	return (
		<Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
			<ScrollableTabBarContent {...props} />
		</Host>
	);
}

export function ScrollableTabBarContent<Selection extends string>({
	selection,
	onSelectionChange,
	options,
	accessibilityLabel: label
}: ScrollableTabBarProps<Selection>) {
	const accent = useAccentColor();
	const reduceMotion = useReduceMotion();
	const position = useNativeState<string | null>(selection);
	useEffect(() => {
		position.value = selection;
	}, [position, selection]);
	const shape = shapes.roundedRectangle({
		cornerRadius: Radius.standard,
		roundedCornerStyle: 'continuous'
	});

	return (
		<ScrollView
			axes="horizontal"
			showsIndicators={false}
			modifiers={[
				defaultScrollAnchorForRole('center', 'alignment'),
				scrollPosition(position, { anchor: 'center' }),
				padding({ vertical: 12 }),
				frame({ maxWidth: Infinity }),
				background(colors.systemGroupedBackground),
				accessibilityElement('contain'),
				accessibilityLabel(label)
			]}
		>
			<HStack spacing={8} modifiers={[padding({ horizontal: 16 }), scrollTargetLayout()]}>
				{options.map((option) => {
					const isSelected = option.value === selection;
					const tint = option.tint ?? accent;
					return (
						<Button
							key={option.value}
							onPress={() => onSelectionChange(option.value)}
							modifiers={[
								id(option.value),
								pressableButtonStyle(),
								...motionAwareAnimation(Motion.state, isSelected, reduceMotion),
								accessibilityElement('ignore'),
								accessibilityLabel(option.title),
								...(isSelected ? [accessibilityAddTraits(['isSelected'])] : [])
							]}
						>
							<HStack
								spacing={7}
								modifiers={[
									font({ textStyle: 'caption', weight: 'semibold' }),
									lineLimit(1),
									fixedSize({ horizontal: true, vertical: false }),
									padding({ horizontal: 12, vertical: 7 }),
									background(isSelected ? withOpacity(tint, 0.15) : '#8E8E9314', shape),
									strokeBorder({
										color: isSelected ? withOpacity(tint, 0.45) : '#00000000',
										style: { lineWidth: 1 },
										shape: 'roundedRectangle',
										cornerRadius: Radius.standard
									})
								]}
							>
								<Image
									systemName={option.systemImage as SFSymbol}
									modifiers={[foregroundStyle(tint)]}
								/>
								<Text modifiers={[foregroundStyle(isSelected ? tint : 'primary')]}>
									{option.title}
								</Text>
							</HStack>
						</Button>
					);
				})}
			</HStack>
		</ScrollView>
	);
}
