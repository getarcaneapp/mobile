/**
 * Port of `MetricRing` (EnvironmentsView.swift): a track ring with a rounded
 * progress arc starting at 12 o'clock. RN svg, so it renders on both
 * platforms (SwiftUI trees host it in an `RNHostView`).
 */
import { useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { springConfig } from '@/theme/motion';
import { Motion } from '@/theme/tokens';
import { useReduceMotion } from '@/ui/components/accessibility';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function MetricRing({
	progress,
	tint,
	size = 18,
	lineWidth = 3
}: {
	progress: number;
	tint: string;
	size?: number;
	lineWidth?: number;
}) {
	const reduceMotion = useReduceMotion();
	const clamped = Math.min(Math.max(progress, 0), 1);
	const value = useSharedValue(0);
	useEffect(() => {
		value.value = reduceMotion
			? clamped
			: withSpring(clamped, springConfig(Motion.gauge.response, Motion.gauge.dampingFraction));
	}, [clamped, reduceMotion, value]);

	const radius = (size - lineWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const animatedProps = useAnimatedProps(() => ({
		strokeDashoffset: circumference * (1 - value.value)
	}));

	return (
		<Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
			<Circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				stroke={tint}
				strokeOpacity={0.18}
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
				strokeDasharray={`${circumference} ${circumference}`}
				animatedProps={animatedProps}
				fill="none"
			/>
		</Svg>
	);
}
