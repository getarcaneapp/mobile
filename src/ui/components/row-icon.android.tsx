import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated';

import { useAccentColor } from '@/theme/accent';
import { colors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';

import { useReduceMotion } from './accessibility';
import { imageReferenceParts, type ImageReferenceParts } from './image-reference';
import { textStyleSize, type RowIconProps, type TextStyleName } from './row-icon.types';
import { monoFamily } from './type-scale';

export function RowIcon({ systemImage, tint, size = 36, changeToken = '' }: RowIconProps) {
	const accent = useAccentColor();
	const reduceMotion = useReduceMotion();
	const color = tint ?? accent;
	const scale = useSharedValue(1);
	const first = useRef(true);
	useEffect(() => {
		if (first.current) {
			first.current = false;
			return;
		}
		if (reduceMotion) return;
		scale.value = withSequence(
			withTiming(1.18, { duration: 120 }),
			withSpring(1, { damping: 8, stiffness: 220 })
		);
	}, [changeToken, reduceMotion, scale]);
	const glyph = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
	return (
		<View
			importantForAccessibility="no-hide-descendants"
			style={{
				width: size,
				height: size,
				borderRadius: Radius.small,
				borderCurve: 'continuous',
				backgroundColor: withOpacity(color, 0.14),
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			<Animated.View style={glyph}>
				<Icon name={systemImage} size={size * 0.5} color={color} />
			</Animated.View>
		</View>
	);
}

export function ImageReferenceName({
	reference,
	textStyle = 'body'
}: {
	reference: ImageReferenceParts;
	textStyle?: TextStyleName;
}) {
	return (
		<Text style={{ fontSize: textStyleSize[textStyle] - 1, color: colors.label }}>
			<Text style={{ color: colors.secondaryLabel }}>{reference.namespace}</Text>
			{reference.name}
		</Text>
	);
}

export function ImageReferenceLine({ reference }: { reference: string }) {
	const parts = imageReferenceParts(reference);
	return (
		<View
			accessible
			accessibilityLabel={reference}
			style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
		>
			<Text
				numberOfLines={1}
				ellipsizeMode="head"
				style={{ flexShrink: 1, fontSize: 12, color: colors.label }}
			>
				<Text style={{ color: colors.secondaryLabel }}>{parts.namespace}</Text>
				{parts.name}
			</Text>
			{parts.tag ? <TagChip text={parts.tag} /> : null}
		</View>
	);
}

export function TagChip({ text }: { text: string }) {
	return (
		<Text
			numberOfLines={1}
			style={{
				fontFamily: monoFamily,
				fontSize: 12,
				color: colors.secondaryLabel,
				paddingHorizontal: 6,
				paddingVertical: 2,
				borderRadius: Radius.small,
				overflow: 'hidden',
				backgroundColor: '#8E8E931F'
			}}
		>
			{text}
		</Text>
	);
}
