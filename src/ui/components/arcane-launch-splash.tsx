import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	interpolate,
	useAnimatedProps,
	useAnimatedReaction,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
	type SharedValue
} from 'react-native-reanimated';
import Svg, {
	ClipPath,
	Defs,
	FeGaussianBlur,
	Filter,
	G,
	LinearGradient,
	Path,
	RadialGradient,
	Rect,
	Stop
} from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, parseHex } from '@/theme/colors';
import { Motion } from '@/theme/tokens';

import { useIsDark, useReduceMotion } from './accessibility';
import { ArcaneLogoPaths } from './arcane-logo-paths';
import { ArcaneLogoTrace, LogoTrace, useTraceClock } from './arcane-logo-trace';
import { animateTo } from './motion-views';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const logoSize = { width: 150, height: 144 };
const traceStart = 0.2;
const traceEnd = traceStart + LogoTrace.duration(ArcaneLogoPaths.pieces.length);
const breathHalfPeriod = Math.PI / 1.1;
const defaultHex = '#AF52DE';

const fitScale = Math.min(
	logoSize.width / ArcaneLogoPaths.width,
	logoSize.height / ArcaneLogoPaths.height
);
const fitOffsetY = (logoSize.height - ArcaneLogoPaths.height * fitScale) / 2;
const fitOffsetX = (logoSize.width - ArcaneLogoPaths.width * fitScale) / 2;
const logoTransform = `translate(${fitOffsetX},${fitOffsetY}) scale(${fitScale}) translate(${ArcaneLogoPaths.translateX},${ArcaneLogoPaths.translateY})`;

function useBlurState(radius: SharedValue<number>, initial: number) {
	const [blur, setBlur] = useState(initial);
	useAnimatedReaction(
		() => Math.round(radius.value * 2) / 2,
		(next, previous) => {
			if (next !== previous) scheduleOnRN(setBlur, next);
		}
	);
	return blur;
}

function SplashLogo({
	color,
	blurRadius,
	filterID
}: {
	color: string;
	blurRadius: number;
	filterID: string;
}) {
	return (
		<Svg width={logoSize.width} height={logoSize.height}>
			<Defs>
				<Filter id={filterID} x="-50%" y="-50%" width="200%" height="200%">
					<FeGaussianBlur stdDeviation={blurRadius / fitScale} />
				</Filter>
			</Defs>
			<G transform={logoTransform} filter={blurRadius > 0 ? `url(#${filterID})` : undefined}>
				{ArcaneLogoPaths.pieces.map((piece) => (
					<Path key={piece.order} d={piece.d} fill={color} />
				))}
			</G>
		</Svg>
	);
}

export type ArcaneLaunchSplashProps = {
	accentColorHex: string;
	onFinished: () => void;
};

export function ArcaneLaunchSplash({ accentColorHex, onFinished }: ArcaneLaunchSplashProps) {
	const reduceMotion = useReduceMotion();
	const isDark = useIsDark();
	const accent = parseHex(accentColorHex) ?? defaultHex;
	const tracesNatively = !reduceMotion;

	const appeared = useSharedValue(0);
	const breath = useSharedValue(0);
	const sheen = useSharedValue(-1);
	const exit = useSharedValue(0);
	const [showsFinishedLogo, setShowsFinishedLogo] = useState(!tracesNatively);
	const time = useTraceClock('elapsed', traceStart, tracesNatively && !showsFinishedLogo);
	const finishedRef = useRef(onFinished);
	finishedRef.current = onFinished;

	const initialBlur = reduceMotion ? 0 : 12;
	const blurRadius = useSharedValue(initialBlur);
	const blur = useBlurState(blurRadius, initialBlur);

	useEffect(() => {
		const timers: ReturnType<typeof setTimeout>[] = [];
		const after = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));

		appeared.value = animateTo(reduceMotion ? Motion.reducedFallback : Motion.splashEnter, 1);
		if (!reduceMotion) {
			blurRadius.value = animateTo(Motion.splashEnter, 0);
			breath.value = withRepeat(
				withTiming(1, { duration: breathHalfPeriod * 1000, easing: Easing.inOut(Easing.ease) }),
				-1,
				true
			);
		}

		const sweepSheen = (delayMs: number) => {
			if (reduceMotion) return;
			sheen.value = animateTo(Motion.splashSheen, 1.4, delayMs);
		};
		const finish = (delayMs: number) =>
			after(delayMs, () => {
				setShowsFinishedLogo(true);
				after(32, () => {
					const token = reduceMotion ? Motion.reducedFallback : Motion.splashExit;
					exit.value = animateTo(token, 1);
					if (!reduceMotion) blurRadius.value = animateTo(token, 14);
					after(reduceMotion ? Motion.reducedFallback.duration : 600, () => finishedRef.current());
				});
			});

		if (!tracesNatively) {
			sweepSheen(reduceMotion ? 0 : 450);
			finish(reduceMotion ? 600 : 1500);
		} else {
			after((traceEnd - 0.35) * 1000, () => {
				sweepSheen(0);
				finish(900);
			});
		}
		return () => timers.forEach(clearTimeout);
	}, [appeared, blurRadius, breath, exit, reduceMotion, sheen, tracesNatively]);

	const rootStyle = useAnimatedStyle(() => ({
		opacity: 1 - Math.min(exit.value, 1),
		transform: [{ scale: reduceMotion ? 1 : 1 + 0.14 * exit.value }]
	}));
	const glowStyle = useAnimatedStyle(() => ({
		opacity: Math.min(appeared.value, 1),
		transform: [
			{
				scale:
					(reduceMotion ? 1 : interpolate(appeared.value, [0, 1], [0.6, 1])) *
					(reduceMotion ? 1 : interpolate(breath.value, [0, 1], [0.965, 1.035]))
			}
		]
	}));
	const logoStyle = useAnimatedStyle(() => ({ opacity: Math.min(appeared.value, 1) }));
	const settleStyle = useAnimatedStyle(() => ({
		transform: [{ scale: reduceMotion ? 1 : interpolate(appeared.value, [0, 1], [0.86, 1]) }]
	}));
	const sheenProps = useAnimatedProps(() => ({ x: sheen.value * logoSize.width }));

	const strength = isDark ? 0.3 : 0.18;
	const glowSize = 600;

	return (
		<Animated.View
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={[
				StyleSheet.absoluteFill,
				{
					backgroundColor: colors.systemBackground,
					alignItems: 'center',
					justifyContent: 'center'
				},
				rootStyle
			]}
		>
			<Animated.View
				style={[{ position: 'absolute', width: glowSize, height: glowSize }, glowStyle]}
			>
				<Svg width={glowSize} height={glowSize}>
					<Defs>
						<RadialGradient
							id="glow"
							cx={glowSize / 2}
							cy={glowSize / 2}
							r={300}
							gradientUnits="userSpaceOnUse"
						>
							<Stop offset="0" stopColor={accent} stopOpacity={strength} />
							<Stop offset="0.5" stopColor={accent} stopOpacity={strength * 0.4} />
							<Stop offset="1" stopColor={accent} stopOpacity={0} />
						</RadialGradient>
					</Defs>
					<Rect width={glowSize} height={glowSize} fill="url(#glow)" />
				</Svg>
			</Animated.View>

			<Animated.View style={[{ width: logoSize.width, height: logoSize.height }, logoStyle]}>
				{tracesNatively && !showsFinishedLogo ? (
					<>
						<Animated.View style={[StyleSheet.absoluteFill, { opacity: 0.12 }, settleStyle]}>
							<SplashLogo color={accent} blurRadius={blur} filterID="silhouetteBlur" />
						</Animated.View>
						<View
							style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
						>
							<ArcaneLogoTrace
								width={ArcaneLogoPaths.width * fitScale}
								accent={accent}
								time={time}
							/>
						</View>
					</>
				) : (
					<Animated.View style={[StyleSheet.absoluteFill, settleStyle]}>
						<SplashLogo color={accent} blurRadius={blur} filterID="logoBlur" />
					</Animated.View>
				)}

				<Svg width={logoSize.width} height={logoSize.height} style={StyleSheet.absoluteFill}>
					<Defs>
						<ClipPath id="logoMask">
							<G transform={logoTransform}>
								{ArcaneLogoPaths.pieces.map((piece) => (
									<Path key={piece.order} d={piece.d} />
								))}
							</G>
						</ClipPath>
						<LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
							<Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
							<Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={isDark ? 0.16 : 0.24} />
							<Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
						</LinearGradient>
					</Defs>
					<G clipPath="url(#logoMask)">
						<G rotation={18} origin={`${logoSize.width / 2}, ${logoSize.height / 2}`}>
							<AnimatedRect
								y={-logoSize.height / 2}
								width={logoSize.width * 0.45}
								height={logoSize.height * 2}
								fill="url(#sheen)"
								animatedProps={sheenProps}
							/>
						</G>
					</G>
				</Svg>
			</Animated.View>
		</Animated.View>
	);
}
