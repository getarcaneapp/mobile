/**
 * Port of `.capsuleProgressBorder(fraction:isActive:tint:)`
 * (CapsuleProgressBorder.swift): progress drawn around a capsule's edge. With
 * a fraction, a 2pt tinted stroke fills clockwise from the top center
 * (animated on `Motion.gauge`); while active without one, a short arc with a
 * fading tail laps the border every 1.8 s. Nothing when idle. Reduce Motion
 * parks the arc at the top.
 *
 * Standalone (RN svg overlay, both platforms). Lay it over the capsule with
 * `StyleSheet.absoluteFill`; it never takes touches.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	cancelAnimation,
	useAnimatedProps,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Motion, type MotionToken } from '@/theme/tokens';

import { useReduceMotion } from './accessibility';
import { animateTo } from './motion-views';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const lapDuration = 1.8;
const arcLength = 0.22;
const trackColor = '#8E8E934D';

/** Capsule outline from top center, clockwise; `inset` keeps the stroke inside the bounds. */
function capsulePath(width: number, height: number, inset: number) {
	const w = width - inset * 2;
	const h = height - inset * 2;
	const r = Math.min(w, h) / 2;
	const x0 = inset;
	const y0 = inset;
	const midX = x0 + w / 2;
	const d =
		`M${midX},${y0} L${x0 + w - r},${y0} ` +
		`A${r},${r} 0 0 1 ${x0 + w - r},${y0 + h} ` +
		`L${x0 + r},${y0 + h} ` +
		`A${r},${r} 0 0 1 ${x0 + r},${y0} Z`;
	const length = 2 * Math.max(w - 2 * r, 0) + 2 * Math.PI * r;
	return { d, length };
}

export type CapsuleProgressBorderProps = {
	/** 0...1 for determinate progress; undefined for none/indeterminate. */
	fraction?: number;
	isActive: boolean;
	/** Hex. */
	tint: string;
	/** How fraction changes animate; `Motion.gauge` by default. */
	animation?: MotionToken;
};

export function CapsuleProgressBorder({
	fraction,
	isActive,
	tint,
	animation = Motion.gauge
}: CapsuleProgressBorderProps) {
	const [size, setSize] = useState({ width: 0, height: 0 });
	const reduceMotion = useReduceMotion();
	const progress = useSharedValue(fraction ?? 0);
	const phase = useSharedValue(0);
	const traveling = isActive && fraction === undefined;

	useEffect(() => {
		if (fraction !== undefined)
			progress.value = animateTo(animation, Math.min(Math.max(fraction, 0), 1));
	}, [fraction, progress, animation]);

	useEffect(() => {
		if (!traveling || reduceMotion) {
			cancelAnimation(phase);
			phase.value = 0;
			return;
		}
		phase.value = 0;
		phase.value = withRepeat(
			withTiming(1, { duration: lapDuration * 1000, easing: Easing.linear }),
			-1,
			false
		);
	}, [traveling, reduceMotion, phase]);

	const track = size.width > 0 ? capsulePath(size.width, size.height, 0.5) : undefined;
	const ring = size.width > 0 ? capsulePath(size.width, size.height, 2) : undefined;
	const length = ring?.length ?? 1;

	const fillProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));
	// The path is drawn twice so a window that wraps past the start stays continuous.
	const headProps = useAnimatedProps(() => {
		const start = (((phase.value - arcLength) % 1) + 1) % 1;
		return { strokeDashoffset: -start * length };
	});
	const tailProps = useAnimatedProps(() => {
		const start = (((phase.value - arcLength * 2) % 1) + 1) % 1;
		return { strokeDashoffset: -start * length };
	});

	if (fraction === undefined && !traveling) return null;

	return (
		<View
			pointerEvents="none"
			style={StyleSheet.absoluteFill}
			onLayout={(e) => setSize(e.nativeEvent.layout)}
		>
			{track && ring ? (
				<Svg width={size.width} height={size.height}>
					<Path d={track.d} stroke={trackColor} strokeWidth={1} fill="none" />
					{fraction !== undefined ? (
						<AnimatedPath
							d={ring.d}
							stroke={tint}
							strokeWidth={2}
							strokeLinecap="round"
							fill="none"
							strokeDasharray={[length, length]}
							animatedProps={fillProps}
						/>
					) : (
						<>
							<AnimatedPath
								d={`${ring.d} ${ring.d}`}
								stroke={tint}
								strokeOpacity={0.3}
								strokeWidth={2}
								strokeLinecap="round"
								fill="none"
								strokeDasharray={[arcLength * 2 * length, length * 3]}
								animatedProps={tailProps}
							/>
							<AnimatedPath
								d={`${ring.d} ${ring.d}`}
								stroke={tint}
								strokeWidth={2}
								strokeLinecap="round"
								fill="none"
								strokeDasharray={[arcLength * length, length * 3]}
								animatedProps={headProps}
							/>
						</>
					)}
				</Svg>
			) : null}
		</View>
	);
}
