import { useEffect, useRef } from 'react';
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
	motion = 'follow',
	identity
}: {
	progress: number;
	tint: string;
	size?: number;
	lineWidth?: number;
	motion?: 'follow' | 'gauge';
	identity?: string;
}) {
	const reduceMotion = useReduceMotion();
	const clamped = Math.min(Math.max(progress, 0), 1);
	const value = useSharedValue(clamped);
	const radius = (size - lineWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const shown = useRef({ identity, progress: clamped });

	useEffect(() => {
		const previous = shown.current;
		shown.current = { identity, progress: clamped };
		if (previous.identity === identity && previous.progress === clamped) return;
		if (reduceMotion || previous.identity !== identity) value.value = clamped;
		else if (motion === 'gauge')
			value.value = withSpring(
				clamped,
				springConfig(Motion.gauge.response, Motion.gauge.dampingFraction)
			);
		else value.value = withTiming(clamped, timingConfig(Motion.follow));
	}, [clamped, identity, motion, reduceMotion, value]);

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
