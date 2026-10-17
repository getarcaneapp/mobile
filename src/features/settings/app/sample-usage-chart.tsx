import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { systemColors } from '@/theme/colors';

const lines = [
	{ name: 'Production', color: systemColors.blue, base: 28, phase: 0 },
	{ name: 'Media', color: systemColors.orange, base: 52, phase: 1.4 },
	{ name: 'Home', color: systemColors.teal, base: 14, phase: 2.6 }
] as const;

const steps = 24;

function catmullRomPath(points: readonly (readonly [number, number])[]): string {
	const first = points[0];
	if (!first) return '';
	let d = `M${first[0]},${first[1]}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i]!;
		const p1 = points[i]!;
		const p2 = points[i + 1]!;
		const p3 = points[i + 2] ?? p2;
		d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
	}
	return d;
}

export function SampleUsageChart({ height = 110 }: { height?: number }) {
	const [width, setWidth] = useState(0);
	const x = (step: number) => (step / (steps - 1)) * width;
	const y = (value: number) => height - (Math.min(Math.max(value, 0), 100) / 100) * height;
	return (
		<View
			style={{ height, alignSelf: 'stretch' }}
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
		>
			{width > 0 ? (
				<Svg width={width} height={height}>
					{lines.map((line) => (
						<Path
							key={line.name}
							d={catmullRomPath(
								Array.from(
									{ length: steps },
									(_, step) =>
										[x(step), y(line.base + 9 * Math.sin(step / 3 + line.phase))] as const
								)
							)}
							stroke={line.color}
							strokeWidth={2}
							strokeLinecap="round"
							fill="none"
						/>
					))}
				</Svg>
			) : null}
		</View>
	);
}
