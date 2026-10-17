import { Capsule, HStack, Rectangle, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
	accessibilityElement,
	accessibilityLabel,
	animation,
	contentTransition,
	font,
	foregroundStyle,
	frame,
	onGeometryChange
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { Motion } from '@/theme/tokens';

import { useReduceMotion } from './accessibility';
import { segmentWidth, severitySegments, type SeverityBarProps } from './severity-bar.types';
import { motionAwareAnimation, swiftAnimation } from './swiftui-motion';

export function SeverityBar(props: SeverityBarProps) {
	const reduceMotion = useReduceMotion();
	const { segments, total, summary } = severitySegments(props);
	const [width, setWidth] = useState(0);

	return (
		<VStack spacing={8} modifiers={[accessibilityElement('ignore'), accessibilityLabel(summary)]}>
			<ZStack
				alignment="leading"
				modifiers={[frame({ height: 8 }), animation(swiftAnimation(Motion.gauge), total)]}
			>
				<Rectangle
					modifiers={[
						foregroundStyle('#00000000'),
						frame({ maxWidth: Infinity }),
						onGeometryChange((frameInfo) => setWidth(frameInfo.width))
					]}
				/>
				{width > 0 ? (
					<HStack
						spacing={total > 0 ? 2 : 0}
						modifiers={[frame({ width, height: 8, alignment: 'leading' })]}
					>
						{total > 0 ? (
							segments
								.filter((segment) => segment.count > 0)
								.map((segment) => (
									<Capsule
										key={segment.label}
										modifiers={[
											foregroundStyle(segment.color),
											frame({ width: segmentWidth(segment.count, total, width) })
										]}
									/>
								))
						) : (
							<Capsule modifiers={[foregroundStyle('#8E8E9326')]} />
						)}
					</HStack>
				) : null}
			</ZStack>
			<HStack spacing={12}>
				{segments.map((segment) => (
					<VStack key={segment.label} spacing={1} modifiers={[frame({ maxWidth: Infinity })]}>
						<Text
							modifiers={[
								font({ textStyle: 'caption', weight: 'bold' }),
								foregroundStyle(segment.count > 0 ? segment.color : 'secondary'),
								contentTransition('numericText'),
								...motionAwareAnimation(Motion.state, segment.count, reduceMotion)
							]}
						>
							{String(segment.count)}
						</Text>
						<Text
							modifiers={[
								font({ textStyle: 'caption2' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{segment.label}
						</Text>
					</VStack>
				))}
			</HStack>
		</VStack>
	);
}
