import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Path, Stop, ClipPath, Rect } from 'react-native-svg';

import type { SparklineSample } from '@/stores/dashboard-stream-logic';
import { colors } from '@/theme/colors';

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

function catmullRomPath(points: readonly (readonly [number, number])[]): string {
	if (points.length === 0) return '';
	const first = points[0]!;
	let d = `M${first[0]},${first[1]}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i]!;
		const p1 = points[i]!;
		const p2 = points[i + 1]!;
		const p3 = points[i + 2] ?? p2;
		const c1x = p1[0] + (p2[0] - p0[0]) / 6;
		const c1y = p1[1] + (p2[1] - p0[1]) / 6;
		const c2x = p2[0] - (p3[0] - p1[0]) / 6;
		const c2y = p2[1] - (p3[1] - p1[1]) / 6;
		d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
	}
	return d;
}

const timeLabel = (ms: number) => {
	const date = new Date(ms);
	return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

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
	const newest =
		Math.max(...lines.map((line) => line.samples[line.samples.length - 1]?.timestamp ?? 0), 0) ||
		Date.now();
	const end = windowEnd(newest);
	const start = end - usageWindowSeconds * 1000;
	const plotWidth = Math.max(width - yAxisWidth, 0);
	const plotHeight = height - xAxisHeight;
	const x = (t: number) => yAxisWidth + ((t - start) / (end - start)) * plotWidth;
	const y = (v: number) => plotHeight - (Math.min(Math.max(v, 0), 100) / 100) * plotHeight;
	const ticks = [start + (end - start) / 6, start + (end - start) / 2, end - (end - start) / 6];

	return (
		<View
			accessible
			accessibilityLabel={`${metric} usage over time for each environment`}
			style={{ height }}
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
		>
			{width > 0 ? (
				<>
					<Svg width={width} height={plotHeight}>
						<Defs>
							<ClipPath id="usage-plot">
								<Rect x={yAxisWidth} y={0} width={plotWidth} height={plotHeight} />
							</ClipPath>
							{lines.length === 1 && lines[0] ? (
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
							) : null}
						</Defs>
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
						<G clipPath="url(#usage-plot)">
							{lines.map((line) => {
								const points = line.samples.map((s) => [x(s.timestamp), y(s.value)] as const);
								if (points.length < 2) return null;
								const path = catmullRomPath(points);
								const firstX = points[0]![0];
								const lastX = points[points.length - 1]![0];
								return (
									<G key={line.id}>
										{lines.length === 1 ? (
											<Path
												d={`${path} L${lastX},${plotHeight} L${firstX},${plotHeight} Z`}
												fill="url(#usage-fill)"
											/>
										) : null}
										<Path
											d={path}
											stroke={line.color}
											strokeWidth={2}
											strokeLinecap="round"
											strokeLinejoin="round"
											fill="none"
										/>
									</G>
								);
							})}
						</G>
					</Svg>
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
					<View style={{ height: xAxisHeight, marginLeft: yAxisWidth }}>
						{ticks.map((tick) => (
							<Text
								key={tick}
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
								{timeLabel(tick)}
							</Text>
						))}
					</View>
				</>
			) : null}
		</View>
	);
}
