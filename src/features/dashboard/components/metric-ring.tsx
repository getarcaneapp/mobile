/**
 * Port of `MetricRing` (EnvironmentsView.swift): a small capacity ring, hairline
 * track plus a round-capped progress arc. Progress animates with
 * `Motion.follow` (or `Motion.gauge` when asked); Reduce Motion jumps.
 *
 * Standalone (RN svg, both platforms).
 */
import { useEffect } from 'react';
import Animated, {
	useAnimatedProps,
	useSharedValue,
	withSpring,
	withTiming
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { springConfig, timingConfig } from '@/theme/motion';
import { Motion } from '@/theme/tokens';
import { withOpacity } from '@/theme/colors';
import { useReduceMotion } from '@/ui/components/accessibility';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function MetricRing({
	progress,
	tint,
	size = 18,
	lineWidth = 3,
	motion = 'follow'
}: {
	progress: number;
	/** Hex tint. */
	tint: string;
	size?: number;
	lineWidth?: number;
	motion?: 'follow' | 'gauge';
}) {
	const reduceMotion = useReduceMotion();
	const clamped = Math.min(Math.max(progress, 0), 1);
	const value = useSharedValue(clamped);
	const radius = (size - lineWidth) / 2;
	const circumference = 2 * Math.PI * radius;

	useEffect(() => {
		if (reduceMotion) value.value = clamped;
		else if (motion === 'gauge')
			value.value = withSpring(
				clamped,
				springConfig(Motion.gauge.response, Motion.gauge.dampingFraction)
			);
		else value.value = withTiming(clamped, timingConfig(Motion.follow));
	}, [clamped, motion, reduceMotion, value]);

	const animatedProps = useAnimatedProps(() => ({
		strokeDashoffset: circumference * (1 - value.value)
	}));

	return (
		<Svg
			width={size}
			height={size}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			<Circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				stroke={withOpacity(tint, 0.18)}
				strokeWidth={lineWidth}
				fill="none"
			/>
			<AnimatedCircle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				stroke={tint}
				strokeWidth={lineWidth}
				strokeLinecap="round"
				fill="none"
				strokeDasharray={`${circumference} ${circumference}`}
				animatedProps={animatedProps}
				transform={`rotate(-90 ${size / 2} ${size / 2})`}
			/>
		</Svg>
	);
}
