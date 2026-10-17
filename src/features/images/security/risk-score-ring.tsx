/**
 * SecurityOverviewView's patch-priority ring: a 14pt track with a rounded
 * score arc from 12 o'clock and the animated count-up (`AnimatedRiskScore`)
 * in the center. The count and arc reveal with `Motion.riskScoreReveal`
 * (`.timingCurve(0.22, 1, 0.36, 1, duration: 1.1)`), instant with Reduce
 * Motion.
 *
 * RN svg, so both platforms share it (SwiftUI trees host it in an `RNHostView`).
 */
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/theme/colors';
import { secondaryHex, useIsDark, useReduceMotion } from '@/ui/components/accessibility';

/** `Motion.riskScoreReveal` (Motion.swift). */
export const riskScoreReveal = { duration: 1100, x1: 0.22, y1: 1, x2: 0.36, y2: 1 } as const;

/** CSS-style cubic bezier timing function (what SwiftUI's `timingCurve` uses). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;
	const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
	const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
	const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
	return (x: number) => {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		let t = x;
		for (let i = 0; i < 8; i++) {
			const error = sampleX(t) - x;
			if (Math.abs(error) < 1e-5) break;
			const slope = slopeX(t);
			if (Math.abs(slope) < 1e-6) break;
			t -= error / slope;
		}
		let lo = 0;
		let hi = 1;
		if (Math.abs(sampleX(t) - x) >= 1e-5) {
			t = x;
			for (let i = 0; i < 20; i++) {
				const value = sampleX(t);
				if (Math.abs(value - x) < 1e-5) break;
				if (value < x) lo = t;
				else hi = t;
				t = (lo + hi) / 2;
			}
		}
		return sampleY(t);
	};
}

const easing = cubicBezier(
	riskScoreReveal.x1,
	riskScoreReveal.y1,
	riskScoreReveal.x2,
	riskScoreReveal.y2
);

type RevealState = { displayed: number; hasAnimated: boolean };

/**
 * `displayedScore` / `hasAnimatedScore` per overview instance, so switching
 * between Score and Trend doesn't replay the reveal. Release with
 * `releaseRiskScoreMemory` when the overview goes away.
 */
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
	/** 0...100. */
	target: number;
	unavailable: boolean;
	/** Arc color (hex), or undefined for `.secondary`. */
	color?: string;
	/** Identifies the owning overview's `displayedScore` state. */
	memoryKey: string;
	size?: number;
	lineWidth?: number;
}) {
	const isDark = useIsDark();
	const reduceMotion = useReduceMotion();
	const [displayed, setDisplayed] = useState(() => revealState(memoryKey).displayed);

	useEffect(() => {
		const state = revealState(memoryKey);
		if (state.hasAnimated && state.displayed === target) {
			setDisplayed(target);
			return;
		}
		state.hasAnimated = true;
		if (reduceMotion) {
			state.displayed = target;
			setDisplayed(target);
			return;
		}
		const from = state.displayed;
		const start = Date.now();
		let frame = 0;
		const step = () => {
			const progress = Math.min((Date.now() - start) / riskScoreReveal.duration, 1);
			const value = from + (target - from) * easing(progress);
			state.displayed = value;
			setDisplayed(value);
			if (progress < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	}, [target, reduceMotion, memoryKey]);

	const scheme = isDark ? 'dark' : 'light';
	const secondary = secondaryHex[scheme];
	// `.quaternary` (quaternaryLabel).
	const track = isDark ? 'rgba(235,235,245,0.16)' : 'rgba(60,60,67,0.18)';
	const radius = (size - lineWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const fraction = Math.min(Math.max(displayed / 100, 0), 1);
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
				{fraction > 0 ? (
					<Circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						stroke={color ?? secondary}
						strokeOpacity={color ? 1 : 0.6}
						strokeWidth={lineWidth}
						strokeLinecap="round"
						strokeDasharray={`${circumference} ${circumference}`}
						strokeDashoffset={circumference * (1 - fraction)}
						fill="none"
					/>
				) : null}
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
							{String(Math.round(Math.min(Math.max(displayed, 0), 100)))}
						</Text>
						<Text style={{ fontSize: 12, color: colors.secondaryLabel }}>/ 100</Text>
					</>
				)}
			</View>
		</View>
	);
}
