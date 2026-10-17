/**
 * Ports of `ResourceStatusBadge` and `StatusIcon` (Android): the same tint,
 * symbol and text as a Material 3 assist-chip-style capsule (card style) or
 * an inline icon + label. Transitional states pulse.
 *
 * Standalone (RN view).
 */
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated';

import { colors, withOpacity } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

import { useReduceMotion } from './accessibility';
import {
	badgePresentation,
	statusIconPresentation,
	type ResourceStatusBadgeProps
} from './resource-status';
import { m3Type } from './type-scale';

const secondary = '#8E8E93';

export function ResourceStatusBadge({
	status,
	isLive,
	usesCardStyle = false,
	label
}: ResourceStatusBadgeProps) {
	const reduceMotion = useReduceMotion();
	const p = badgePresentation({ status, isLive, label });
	const tint = p.tint ?? (colors.secondaryLabel as string);
	const tintHex = p.tint ?? secondary;
	const pulse = useSharedValue(1);
	const pulses = usesCardStyle && p.isTransitional && !reduceMotion;

	useEffect(() => {
		if (pulses) {
			pulse.value = withRepeat(withTiming(0.4, { duration: 700 }), -1, true);
		} else {
			cancelAnimation(pulse);
			pulse.value = 1;
		}
	}, [pulses, pulse]);
	const iconStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

	return (
		<View
			accessible
			accessibilityLabel={`${p.displayText} status`}
			style={[
				{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
				usesCardStyle && {
					paddingHorizontal: 8,
					paddingVertical: 4,
					borderRadius: 999,
					backgroundColor: withOpacity(tintHex, p.live ? 0.16 : 0.12),
					borderWidth: 0.75,
					borderColor: withOpacity(tintHex, p.live ? 0.28 : 0.18)
				}
			]}
		>
			<Animated.View style={iconStyle}>
				<Icon name={p.icon} size={usesCardStyle ? 14 : 16} color={tint} />
			</Animated.View>
			<Text
				numberOfLines={usesCardStyle ? 1 : undefined}
				adjustsFontSizeToFit={usesCardStyle}
				minimumFontScale={0.8}
				style={[usesCardStyle ? m3Type.labelSmall : m3Type.bodyMedium, { color: tint }]}
			>
				{p.displayText}
			</Text>
		</View>
	);
}

/** Compact, text-free status indicator for dense list rows. */
export function StatusIcon({ status, isLive }: { status?: string; isLive?: boolean }) {
	const config = statusIconPresentation(status, isLive);
	return (
		<View accessible accessibilityLabel={`${config.label} status`}>
			<Icon name={config.icon} size={22} color={config.color ?? colors.secondaryLabel} />
		</View>
	);
}
