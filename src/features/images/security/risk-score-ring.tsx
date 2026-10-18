import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedProps,
	useAnimatedReaction,
	useSharedValue,
	withTiming
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { colors } from '@/theme/colors';
import { secondaryHex, useIsDark, useReduceMotion } from '@/ui/components/accessibility';

export const riskScoreReveal = { duration: 1100, x1: 0.22, y1: 1, x2: 0.36, y2: 1 } as const;

const easing = Easing.bezier(
	riskScoreReveal.x1,
	riskScoreReveal.y1,
	riskScoreReveal.x2,
	riskScoreReveal.y2
);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type RevealState = { displayed: number; hasAnimated: boolean };

const reveals = new Map<string, RevealState>();

function revealState(key: string): RevealState {
	let state = reveals.get(key);
	if (!state) {
		state = { displayed: 0, hasAnimated: false };
		reveals.set(key, state);
	}
	return state;
}

export function releaseRiskScoreMemory(key: string) {
	reveals.delete(key);
}

export function RiskScoreRing({
	target,
	unavailable,
	color,
	memoryKey,
	size = 170,
	lineWidth = 14
}: {
	target: number;
	unavailable: boolean;
	color?: string;
	memoryKey: string;
	size?: number;
	lineWidth?: number;
}) {
	const isDark = useIsDark();
	const reduceMotion = useReduceMotion();
	const value = useSharedValue(revealState(memoryKey).displayed);
	const [displayed, setDisplayed] = useState(() => Math.round(revealState(memoryKey).displayed));

	useAnimatedReaction(
		() => Math.round(Math.min(Math.max(value.value, 0), 100)),
		(current, previous) => {
			if (current !== previous) scheduleOnRN(setDisplayed, current);
		}
	);

	useEffect(() => {
		const state = revealState(memoryKey);
		if (state.hasAnimated && state.displayed === target) {
			value.value = target;
			return;
		}
		state.hasAnimated = true;
		if (reduceMotion) {
			state.displayed = target;
			value.value = target;
			return;
		}
		state.displayed = target;
		value.value = withTiming(target, { duration: riskScoreReveal.duration, easing });
		return () => {
			state.displayed = value.value;
			cancelAnimation(value);
		};
	}, [target, reduceMotion, memoryKey, value]);

	const scheme = isDark ? 'dark' : 'light';
	const secondary = secondaryHex[scheme];
	const track = isDark ? 'rgba(235,235,245,0.16)' : 'rgba(60,60,67,0.18)';
	const radius = (size - lineWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const animatedProps = useAnimatedProps(() => {
		const fraction = Math.min(Math.max(value.value / 100, 0), 1);
		return {
			strokeDashoffset: circumference * (1 - fraction),
			strokeOpacity: fraction > 0 ? (color ? 1 : 0.6) : 0
		};
	});
	const rounded = Platform.OS === 'ios' ? 'ui-rounded' : undefined;

	return (
		<View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
			<Svg
				width={size}
				height={size}
				style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
			>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke={track}
					strokeWidth={lineWidth}
					fill="none"
				/>
				<AnimatedCircle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke={color ?? secondary}
					strokeWidth={lineWidth}
					strokeLinecap="round"
					strokeDasharray={`${circumference} ${circumference}`}
					animatedProps={animatedProps}
					fill="none"
				/>
			</Svg>
			<View style={{ alignItems: 'center', gap: 2 }}>
				{unavailable ? (
					<Text
						style={{ fontSize: 54, fontWeight: '600', fontFamily: rounded, color: colors.label }}
					>
						–
					</Text>
				) : (
					<>
						<Text
							style={{
								fontSize: 54,
								fontWeight: '600',
								fontFamily: rounded,
								fontVariant: ['tabular-nums'],
								color: colors.label
							}}
						>
							{String(displayed)}
						</Text>
						<Text style={{ fontSize: 12, color: colors.secondaryLabel }}>/ 100</Text>
					</>
				)}
			</View>
		</View>
	);
}
