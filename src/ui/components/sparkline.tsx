/**
 * Port of `Sparkline` (Sparkline.swift): a thin 1.5pt line over a soft
 * gradient fill (tint 18% → 2%). Fixed Y domain so new samples never rescale
 * the line; X uses real timestamps so gaps render honestly. Height is constant
 * with or without data (glass cards cache their shape). Fewer than two samples
 * draws a faint midline placeholder.
 *
 * Standalone (RN view, both platforms). SwiftUI trees: `SparklineSwiftUI`.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export type SparklineSample = { timestamp: Date | number; value: number };

export type SparklineProps = {
	samples: SparklineSample[];
	/** Hex tint. */
	tint: string;
	/** Fixed value domain; defaults to 0–100 for percentage series. */
	range?: [number, number];
	height?: number;
};

const time = (t: Date | number) => (typeof t === 'number' ? t : t.getTime()) / 1000;

let gradientID = 0;

export function Sparkline({ samples, tint, range = [0, 100], height = 36 }: SparklineProps) {
	const [width, setWidth] = useState(0);
	const [id] = useState(() => `sparkline-${gradientID++}`);

	let content = null;
	if (width > 0) {
		if (samples.length < 2) {
			content = (
				<Path
					d={`M0,${height / 2} L${width},${height / 2}`}
					stroke="#8E8E93"
					strokeOpacity={0.2}
					strokeWidth={1.5}
					strokeLinecap="round"
				/>
			);
		} else {
			const first = samples[0];
			const last = samples[samples.length - 1];
			if (first && last) {
				const start = time(first.timestamp);
				const span = Math.max(time(last.timestamp) - start, 1);
				const valueSpan = Math.max(range[1] - range[0], Number.MIN_VALUE);
				const points = samples.map((sample) => {
					const x = width * ((time(sample.timestamp) - start) / span);
					const normalized = Math.min(Math.max((sample.value - range[0]) / valueSpan, 0), 1);
					return [x, height * (1 - normalized)] as const;
				});
				const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
				const firstX = points[0]?.[0] ?? 0;
				const lastX = points[points.length - 1]?.[0] ?? 0;
				const area = `${line} L${lastX},${height} L${firstX},${height} Z`;
				content = (
					<>
						<Defs>
							<LinearGradient
								id={id}
								x1="0"
								y1="0"
								x2="0"
								y2={height}
								gradientUnits="userSpaceOnUse"
							>
								<Stop offset="0" stopColor={tint} stopOpacity={0.18} />
								<Stop offset="1" stopColor={tint} stopOpacity={0.02} />
							</LinearGradient>
						</Defs>
						<Path d={area} fill={`url(#${id})`} />
						<Path
							d={line}
							stroke={tint}
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
							fill="none"
						/>
					</>
				);
			}
		}
	}

	return (
		<View
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
			style={{ height }}
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
		>
			{width > 0 ? (
				<Svg width={width} height={height}>
					{content}
				</Svg>
			) : null}
		</View>
	);
}
