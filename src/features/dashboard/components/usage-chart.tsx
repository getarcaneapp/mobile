import { useLayoutEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue
} from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import type { SparklineSample } from '@/stores/dashboard-stream-logic';
import { colors } from '@/theme/colors';
import { Motion } from '@/theme/tokens';
import { useReduceMotion } from '@/ui/components/accessibility';
import { animateTo } from '@/ui/components/motion-views';

import { usageWindowSeconds, windowEnd } from '../dashboard-logic';

export type UsageLine = {
	id: string;
	name: string;
	color: string;
	samples: SparklineSample[];
	current?: number;
};

const yAxisWidth = 34;
const xAxisHeight = 18;
const windowMs = usageWindowSeconds * 1000;
const slidePadding = 24;
const maxAnimatedStepMs = 4000;

const round = (value: number) => Math.round(value * 10) / 10;

function catmullRomPath(points: readonly (readonly [number, number])[]): string {
	if (points.length === 0) return '';
	const first = points[0]!;
	let d = `M${round(first[0])},${round(first[1])}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i]!;
		const p1 = points[i]!;
		const p2 = points[i + 1]!;
		const p3 = points[i + 2] ?? p2;
		const c1x = p1[0] + (p2[0] - p0[0]) / 6;
		const c1y = p1[1] + (p2[1] - p0[1]) / 6;
		const c2x = p2[0] - (p3[0] - p1[0]) / 6;
		const c2y = p2[1] - (p3[1] - p1[1]) / 6;
		d += ` C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(p2[0])},${round(p2[1])}`;
	}
	return d;
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

const plotY = (value: number, plotHeight: number) =>
	plotHeight - (Math.min(Math.max(value, 0), 100) / 100) * plotHeight;

function UsageLinePath({
	samples,
	color,
	filled,
	start,
	plotWidth,
	plotHeight
}: {
	samples: readonly SparklineSample[];
	color: string;
	filled: boolean;
	start: number;
	plotWidth: number;
	plotHeight: number;
}) {
	if (samples.length < 2) return null;
	const points = samples.map(
		(s) =>
			[
				slidePadding + ((s.timestamp - start) / windowMs) * plotWidth,
				plotY(s.value, plotHeight)
			] as const
	);
	const path = catmullRomPath(points);
	const firstX = round(points[0]![0]);
	const lastX = round(points[points.length - 1]![0]);
	return (
		<>
			{filled ? (
				<Path
					d={`${path} L${lastX},${plotHeight} L${firstX},${plotHeight} Z`}
					fill="url(#usage-fill)"
				/>
			) : null}
			<Path
				d={path}
				stroke={color}
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
		</>
	);
}

export function UsageChart({
	lines,
	metric,
	height = 150
}: {
	lines: UsageLine[];
	metric: string;
	height?: number;
}) {
	const [width, setWidth] = useState(0);
	const reduceMotion = useReduceMotion();
	const newest =
		Math.max(...lines.map((line) => line.samples[line.samples.length - 1]?.timestamp ?? 0), 0) ||
		Date.now();
	const end = windowEnd(newest);
	const start = end - windowMs;
	const plotWidth = Math.max(width - yAxisWidth, 0);
	const plotHeight = height - xAxisHeight;
	const x = (t: number) => yAxisWidth + ((t - start) / windowMs) * plotWidth;
	const y = (v: number) => plotY(v, plotHeight);
	const ticks = [start + windowMs / 6, start + windowMs / 2, end - windowMs / 6];

	const offset = useSharedValue(0);
	const shownEnd = useRef<number | undefined>(undefined);
	useLayoutEffect(() => {
		const previous = shownEnd.current;
		shownEnd.current = end;
		if (previous === undefined || plotWidth === 0) return;
		const delta = end - previous;
		cancelAnimation(offset);
		if (reduceMotion || delta <= 0 || delta > maxAnimatedStepMs) {
			offset.value = 0;
			return;
		}
		offset.value = Math.min(offset.value + (delta / windowMs) * plotWidth, slidePadding);
		offset.value = animateTo(Motion.chartScroll, 0);
	}, [end, plotWidth, reduceMotion, offset]);
	const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

	return (
		<View
			accessible
			accessibilityLabel={`${metric} usage over time for each environment`}
			style={{ height }}
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
		>
			{width > 0 ? (
				<>
					<Svg width={width} height={plotHeight} style={{ position: 'absolute', left: 0, top: 0 }}>
						{[0, 50, 100].map((value) => (
							<Line
								key={value}
								x1={yAxisWidth}
								x2={width}
								y1={Math.min(Math.max(y(value), 0.25), plotHeight - 0.25)}
								y2={Math.min(Math.max(y(value), 0.25), plotHeight - 0.25)}
								stroke="#8E8E93"
								strokeOpacity={0.45}
								strokeWidth={0.5}
								strokeDasharray="3 3"
							/>
						))}
					</Svg>
					<View
						style={{
							position: 'absolute',
							left: yAxisWidth,
							top: 0,
							width: plotWidth,
							height: plotHeight,
							overflow: 'hidden'
						}}
					>
						<Animated.View
							style={[
								{
									position: 'absolute',
									left: -slidePadding,
									top: 0,
									width: plotWidth + slidePadding,
									height: plotHeight
								},
								slideStyle
							]}
						>
							<Svg width={plotWidth + slidePadding} height={plotHeight}>
								{lines.length === 1 && lines[0] ? (
									<Defs>
										<LinearGradient
											id="usage-fill"
											x1="0"
											y1="0"
											x2="0"
											y2={plotHeight}
											gradientUnits="userSpaceOnUse"
										>
											<Stop offset="0" stopColor={lines[0].color} stopOpacity={0.25} />
											<Stop offset="1" stopColor={lines[0].color} stopOpacity={0} />
										</LinearGradient>
									</Defs>
								) : null}
								{lines.map((line) => (
									<UsageLinePath
										key={line.id}
										samples={line.samples}
										color={line.color}
										filled={lines.length === 1}
										start={start}
										plotWidth={plotWidth}
										plotHeight={plotHeight}
									/>
								))}
							</Svg>
						</Animated.View>
					</View>
					{[100, 50, 0].map((value) => (
						<Text
							key={value}
							numberOfLines={1}
							style={{
								position: 'absolute',
								left: 0,
								width: yAxisWidth - 2,
								top: Math.min(Math.max(y(value) - 7, -2), plotHeight - 12),
								fontSize: 10,
								color: colors.secondaryLabel,
								textAlign: 'left',
								fontVariant: ['tabular-nums']
							}}
						>
							{`${value}%`}
						</Text>
					))}
					<View style={{ position: 'absolute', top: plotHeight, left: yAxisWidth, right: 0 }}>
						<View style={{ height: xAxisHeight }}>
							{ticks.map((tick, index) => (
								<Text
									key={index}
									numberOfLines={1}
									style={{
										position: 'absolute',
										left: x(tick) - yAxisWidth - 30,
										width: 60,
										top: 4,
										textAlign: 'center',
										fontSize: 10,
										color: colors.secondaryLabel
									}}
								>
									{timeFormat.format(tick)}
								</Text>
							))}
						</View>
					</View>
				</>
			) : null}
		</View>
	);
}
