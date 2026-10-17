/**
 * Android ports of the skeleton placeholders: the same neutral fill and
 * contained 1.6 s sweep, driven by Reanimated.
 *
 * Standalone (RN views).
 */
import { use, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { withOpacity } from '@/theme/colors';

import { useIsDark, useReduceMotion } from './accessibility';
import {
	SkeletonShimmerContext,
	shimmerPeriod,
	skeletonAlpha,
	skeletonBase,
	sweepColor,
	type SkeletonCircleProps,
	type SkeletonRectProps
} from './skeleton.types';

export function SkeletonShimmer({ children }: { children: ReactNode }) {
	const reduceMotion = useReduceMotion();
	return <SkeletonShimmerContext value={!reduceMotion}>{children}</SkeletonShimmerContext>;
}

function SkeletonFill({
	width,
	height,
	radius,
	fillOpacity = 0.18
}: {
	width?: number;
	height: number;
	radius: number;
	fillOpacity?: number;
}) {
	const shimmerActive = use(SkeletonShimmerContext);
	const isDark = useIsDark();
	const [measured, setMeasured] = useState(0);
	const progress = useSharedValue(0);
	const band = Math.max(measured * 0.45, 28);

	useEffect(() => {
		if (!shimmerActive) return;
		progress.value = withRepeat(
			withTiming(1, { duration: shimmerPeriod * 1000, easing: Easing.linear }),
			-1,
			false
		);
	}, [shimmerActive, progress]);

	const sweepStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: -band + progress.value * (measured + band) }]
	}));
	const sweep = sweepColor(isDark);

	return (
		<View
			onLayout={(event) => setMeasured(event.nativeEvent.layout.width)}
			style={{
				width,
				alignSelf: width === undefined ? 'stretch' : undefined,
				height,
				borderRadius: radius,
				overflow: 'hidden',
				backgroundColor: withOpacity(
					skeletonBase[isDark ? 'dark' : 'light'],
					skeletonAlpha(fillOpacity)
				)
			}}
		>
			{shimmerActive && measured > 0 ? (
				<Animated.View
					pointerEvents="none"
					style={[{ position: 'absolute', top: 0, bottom: 0, width: band }, sweepStyle]}
				>
					<Svg width={band} height={height}>
						<Defs>
							<LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
								<Stop offset="0" stopColor={sweep.slice(0, 7)} stopOpacity={0} />
								<Stop
									offset="0.5"
									stopColor={sweep.slice(0, 7)}
									stopOpacity={parseInt(sweep.slice(7), 16) / 255}
								/>
								<Stop offset="1" stopColor={sweep.slice(0, 7)} stopOpacity={0} />
							</LinearGradient>
						</Defs>
						<Rect width={band} height={height} fill="url(#sweep)" />
					</Svg>
				</Animated.View>
			) : null}
		</View>
	);
}

export function SkeletonRect({ width, height, cornerRadius = 4, fillOpacity }: SkeletonRectProps) {
	return (
		<SkeletonFill width={width} height={height} radius={cornerRadius} fillOpacity={fillOpacity} />
	);
}

export function SkeletonCircle({ size, fillOpacity }: SkeletonCircleProps) {
	return <SkeletonFill width={size} height={size} radius={size / 2} fillOpacity={fillOpacity} />;
}
