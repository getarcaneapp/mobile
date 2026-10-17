/**
 * Ports of `skeletonShimmer()`, `SkeletonFill`, `SkeletonRect` and
 * `SkeletonCircle` (SkeletonViews.swift): neutral placeholders with a
 * contained highlight that sweeps across while data loads. Fills under one
 * `SkeletonShimmer` appear together, so their sweeps stay in step.
 *
 * SwiftUI-tree.
 */
import { Circle, Rectangle, RoundedRectangle, ZStack } from '@expo/ui/swift-ui';
import {
	Animation,
	animation,
	clipShape,
	foregroundStyle,
	frame,
	offset,
	onAppear,
	onGeometryChange
} from '@expo/ui/swift-ui/modifiers';
import { use, useState, type ReactNode } from 'react';

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

/** Turns on the sweep for every skeleton fill below. Placeholders render static without it or under Reduce Motion. */
export function SkeletonShimmer({ children }: { children: ReactNode }) {
	const reduceMotion = useReduceMotion();
	return <SkeletonShimmerContext value={!reduceMotion}>{children}</SkeletonShimmerContext>;
}

/** SwiftUI has no repeatForever here; this many laps outlasts any loading state. */
const forever = 100_000;

function SkeletonFill({
	shape,
	cornerRadius = 4,
	width,
	height,
	fillOpacity = 0.18
}: {
	shape: 'roundedRectangle' | 'circle';
	cornerRadius?: number;
	width?: number;
	height: number;
	fillOpacity?: number;
}) {
	const shimmerActive = use(SkeletonShimmerContext);
	const isDark = useIsDark();
	const [measured, setMeasured] = useState(0);
	const [swept, setSwept] = useState(false);
	const fill = withOpacity(skeletonBase[isDark ? 'dark' : 'light'], skeletonAlpha(fillOpacity));
	const band = Math.max(measured * 0.45, 28);
	const sweep = sweepColor(isDark);

	return (
		<ZStack
			alignment="leading"
			modifiers={[
				width !== undefined
					? frame({ width, height })
					: frame({ maxWidth: Infinity, minHeight: height, maxHeight: height }),
				onGeometryChange((size) => setMeasured(size.width)),
				clipShape(shape, cornerRadius)
			]}
		>
			{shape === 'circle' ? (
				<Circle modifiers={[foregroundStyle(fill)]} />
			) : (
				<RoundedRectangle cornerRadius={cornerRadius} modifiers={[foregroundStyle(fill)]} />
			)}
			{shimmerActive && measured > 0 ? (
				<Rectangle
					modifiers={[
						foregroundStyle({
							type: 'linearGradient',
							colors: ['#FFFFFF00', sweep, '#FFFFFF00'],
							startPoint: { x: 0, y: 0.5 },
							endPoint: { x: 1, y: 0.5 }
						}),
						frame({ width: band }),
						offset({ x: swept ? measured : -band }),
						animation(
							Animation.linear({ duration: shimmerPeriod }).repeat({
								repeatCount: forever,
								autoreverses: false
							}),
							swept
						),
						onAppear(() => setSwept(true))
					]}
				/>
			) : null}
		</ZStack>
	);
}

/** A rounded rectangle stand-in for text or other content while data loads. */
export function SkeletonRect({ width, height, cornerRadius = 4, fillOpacity }: SkeletonRectProps) {
	return (
		<SkeletonFill
			shape="roundedRectangle"
			width={width}
			height={height}
			cornerRadius={cornerRadius}
			fillOpacity={fillOpacity}
		/>
	);
}

/** A circle placeholder for avatars and icons. */
export function SkeletonCircle({ size, fillOpacity }: SkeletonCircleProps) {
	return <SkeletonFill shape="circle" width={size} height={size} fillOpacity={fillOpacity} />;
}
