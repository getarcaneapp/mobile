import { Host } from '@/ui/host';
import { Button, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	background,
	buttonStyle,
	contentShape,
	contentTransition,
	font,
	foregroundStyle,
	frame,
	monospacedDigit,
	padding,
	shapes
} from '@expo/ui/swift-ui/modifiers';

import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { Motion, Radius } from '@/theme/tokens';

import { useReduceMotion } from './accessibility';
import { formatRemaining, useRemainingSeconds, type DemoBannerProps } from './demo-banner.types';
import { glassEffectCompat } from './swiftui-surfaces';
import { motionAwareAnimation } from './swiftui-motion';

export function DemoBanner({ endsAt, onEnd }: DemoBannerProps) {
	const brand = useAccentColor();
	const reduceMotion = useReduceMotion();
	const remaining = useRemainingSeconds(endsAt);
	const isLowTime = remaining < 60;

	return (
		<Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
			<HStack
				spacing={12}
				modifiers={[
					padding({ horizontal: 12, vertical: 10 }),
					glassEffectCompat({ shape: 'roundedRectangle', cornerRadius: Radius.card }),
					padding({ horizontal: 12 }),
					padding({ top: 6, bottom: 4 })
				]}
			>
				<Image
					systemName="sparkles"
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'semibold' }),
						foregroundStyle(brand),
						frame({ width: 28, height: 28 }),
						background(withOpacity(brand, 0.12), shapes.circle())
					]}
				/>
				<VStack alignment="leading" spacing={1}>
					<Text
						modifiers={[
							font({ textStyle: 'subheadline', weight: 'semibold' }),
							foregroundStyle('primary')
						]}
					>
						Demo Mode
					</Text>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							monospacedDigit(),
							foregroundStyle(isLowTime ? systemColors.orange : 'secondary'),
							contentTransition('numericText', { countsDown: true }),
							...motionAwareAnimation(Motion.state, isLowTime, reduceMotion)
						]}
					>
						{formatRemaining(remaining)}
					</Text>
				</VStack>
				<Spacer minLength={8} />
				<Button onPress={onEnd} modifiers={[buttonStyle('plain')]}>
					<Text
						modifiers={[
							font({ textStyle: 'subheadline', weight: 'semibold' }),
							padding({ horizontal: 14, vertical: 7 }),
							foregroundStyle(brand),
							glassEffectCompat({ tint: withOpacity(brand, 0.18), shape: 'capsule' }),
							frame({ minWidth: 44, minHeight: 44 }),
							contentShape(shapes.rectangle())
						]}
					>
						End
					</Text>
				</Button>
			</HStack>
		</Host>
	);
}
