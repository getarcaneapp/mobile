import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { G, Line, Path } from 'react-native-svg';

import { colors } from '@/theme/colors';

export type ChartSeries = { values: number[]; color: string; fillOpacity?: number };

export function niceTicks(maximum: number, count = 4): number[] {
	if (!(maximum > 0) || !Number.isFinite(maximum)) return [0, 1];
	const rough = maximum / count;
	const magnitude = 10 ** Math.floor(Math.log10(rough));
	const step =
		[1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
	const ticks: number[] = [];
	for (let value = 0; value < maximum + step * 0.999; value += step)
		ticks.push(Number(value.toPrecision(12)));
	return ticks;
}

function tickLabel(value: number, step: number) {
	if (value >= 1_000_000_000) return `${+(value / 1_000_000_000).toFixed(1)}B`;
	if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
	if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}k`;
	const decimals = step > 0 && step < 1 ? Math.min(Math.ceil(-Math.log10(step) - 1e-9) + 1, 6) : 1;
	return `${+value.toFixed(decimals)}`;
}

const round = (value: number) => Math.round(value * 10) / 10;

function monotonePath(points: [number, number][]): string {
	if (points.length === 0) return '';
	if (points.length === 1) return `M${round(points[0]![0])},${round(points[0]![1])}`;
	const n = points.length;
	const dx: number[] = [];
	const slope: number[] = [];
	for (let i = 0; i < n - 1; i++) {
		dx.push(points[i + 1]![0] - points[i]![0]);
		slope.push((points[i + 1]![1] - points[i]![1]) / (dx[i] || 1));
	}
	const tangent: number[] = [slope[0]!];
	for (let i = 1; i < n - 1; i++) {
		const a = slope[i - 1]!;
		const b = slope[i]!;
		tangent.push(
			a * b <= 0
				? 0
				: (3 * (dx[i - 1]! + dx[i]!)) /
						((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b)
		);
	}
	tangent.push(slope[n - 2]!);
	let d = `M${round(points[0]![0])},${round(points[0]![1])}`;
	for (let i = 0; i < n - 1; i++) {
		const [x0, y0] = points[i]!;
		const [x1, y1] = points[i + 1]!;
		const h = dx[i]! / 3;
		d += ` C${round(x0 + h)},${round(y0 + tangent[i]! * h)} ${round(x1 - h)},${round(y1 - tangent[i + 1]! * h)} ${round(x1)},${round(y1)}`;
	}
	return d;
}

export function StatsLineChart({
	series,
	height = 140
}: {
	series: ChartSeries[];
	height?: number;
}) {
	const [width, setWidth] = useState(0);
	const maximum = Math.max(0, ...series.flatMap((s) => s.values));
	const ticks = niceTicks(maximum);
	const top = ticks[ticks.length - 1] || 1;
	const labels = ticks.map((tick) => tickLabel(tick, ticks[1] ?? 0));
	const axisWidth = Math.max(34, Math.max(...labels.map((label) => label.length)) * 6 + 10);
	const plotWidth = Math.max(width - axisWidth, 0);
	const y = (value: number) =>
		height - (Math.min(Math.max(value, 0), top) / top) * (height - 6) - 1;

	return (
		<View
			style={{ height, flexDirection: 'row' }}
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
		>
			<View style={{ width: axisWidth, height }}>
				{ticks.map((tick, index) => (
					<Text
						key={index}
						numberOfLines={1}
						style={{
							position: 'absolute',
							top: y(tick) - 7,
							right: 6,
							fontSize: 10,
							color: colors.secondaryLabel,
							fontVariant: ['tabular-nums']
						}}
					>
						{labels[index]}
					</Text>
				))}
			</View>
			{plotWidth > 0 ? (
				<Svg width={plotWidth} height={height}>
					{ticks.map((tick, index) => (
						<Line
							key={index}
							x1={0}
							x2={plotWidth}
							y1={y(tick)}
							y2={y(tick)}
							stroke="#8E8E93"
							strokeOpacity={0.25}
							strokeWidth={0.5}
						/>
					))}
					{series.map((s, index) => {
						const count = s.values.length;
						const points = s.values.map((value, i): [number, number] => [
							count <= 1 ? 0 : (i / (count - 1)) * plotWidth,
							y(value)
						]);
						const line = monotonePath(points);
						const last = points[points.length - 1];
						return (
							<G key={index}>
								{s.fillOpacity && last ? (
									<Path
										d={`${line} L${round(last[0])},${height} L0,${height} Z`}
										fill={s.color}
										fillOpacity={s.fillOpacity}
									/>
								) : null}
								<Path
									d={line}
									stroke={s.color}
									strokeWidth={2}
									fill="none"
									strokeLinejoin="round"
									strokeLinecap="round"
								/>
							</G>
						);
					})}
				</Svg>
			) : null}
		</View>
	);
}
