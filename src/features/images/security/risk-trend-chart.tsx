import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { colors } from '@/theme/colors';

const ticks = [0, 25, 50, 75, 100];

function monotonePath(points: [number, number][]): string {
	const first = points[0];
	if (!first) return '';
	if (points.length === 1) return `M${first[0]},${first[1]}`;
	const n = points.length;
	const dx: number[] = [];
	const slope: number[] = [];
	for (let i = 0; i < n - 1; i++) {
		const a = points[i]!;
		const b = points[i + 1]!;
		dx.push(b[0] - a[0]);
		slope.push((b[1] - a[1]) / (dx[i] || 1));
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
	let d = `M${first[0]},${first[1]}`;
	for (let i = 0; i < n - 1; i++) {
		const [x0, y0] = points[i]!;
		const [x1, y1] = points[i + 1]!;
		const h = dx[i]! / 3;
		d += ` C${x0 + h},${y0 + tangent[i]! * h} ${x1 - h},${y1 - tangent[i + 1]! * h} ${x1},${y1}`;
	}
	return d;
}

export function RiskTrendChart({
	values,
	color,
	height = 130
}: {
	values: number[];
	color: string;
	height?: number;
}) {
	const [width, setWidth] = useState(0);
	const axisWidth = 28;
	const plotWidth = Math.max(width - axisWidth, 0);
	const inset = 1;
	const y = (value: number) =>
		inset + (1 - Math.min(Math.max(value, 0), 100) / 100) * (height - inset * 2);
	const count = values.length;
	const points = values.map((value, i): [number, number] => [
		count <= 1 ? 0 : (i / (count - 1)) * plotWidth,
		y(value)
	]);
	const line = monotonePath(points);
	const last = points[points.length - 1];
	const baseline = y(0);

	return (
		<View
			style={{ height, flexDirection: 'row' }}
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
		>
			{plotWidth > 0 ? (
				<Svg width={plotWidth} height={height}>
					{ticks.map((tick) => (
						<Line
							key={tick}
							x1={0}
							x2={plotWidth}
							y1={y(tick)}
							y2={y(tick)}
							stroke="#8E8E93"
							strokeOpacity={0.25}
							strokeWidth={0.5}
						/>
					))}
					{last ? (
						<Path
							d={`${line} L${last[0]},${baseline} L0,${baseline} Z`}
							fill={color}
							fillOpacity={0.14}
						/>
					) : null}
					<Path
						d={line}
						stroke={color}
						strokeWidth={2}
						fill="none"
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
				</Svg>
			) : null}
			<View style={{ width: axisWidth, height }}>
				{ticks.map((tick) => (
					<Text
						key={tick}
						style={{
							position: 'absolute',
							top: y(tick) - 7,
							left: 6,
							fontSize: 10,
							color: colors.secondaryLabel,
							fontVariant: ['tabular-nums']
						}}
					>
						{String(tick)}
					</Text>
				))}
			</View>
		</View>
	);
}
