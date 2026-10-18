import { useEffect, useRef } from 'react';
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
	lineWidth = 3,
	identity
}: {
	progress: number;
	tint: string;
	size?: number;
	lineWidth?: number;
	identity?: string;
}) {
	const reduceMotion = useReduceMotion();
	const clamped = Math.min(Math.max(progress, 0), 1);
	const value = useSharedValue(clamped);
	const shown = useRef({ identity, progress: clamped });
	useEffect(() => {
		const previous = shown.current;
		shown.current = { identity, progress: clamped };
		if (previous.identity === identity && previous.progress === clamped) return;
		value.value =
			reduceMotion || previous.identity !== identity
				? clamped
				: withSpring(clamped, springConfig(Motion.gauge.response, Motion.gauge.dampingFraction));
	}, [clamped, identity, reduceMotion, value]);

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
