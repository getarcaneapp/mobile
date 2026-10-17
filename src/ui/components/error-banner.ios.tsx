import { Button, HStack, Spacer, Text } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	background,
	buttonStyle,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	multilineTextAlignment,
	padding,
	shapes,
	strokeBorder
} from '@expo/ui/swift-ui/modifiers';

import { withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';

import {
	errorBannerAccessibilityPrefix,
	errorBannerTint,
	type ErrorBannerProps
} from './error-banner.types';

export function ErrorBanner({ message, severity = 'error', retry }: ErrorBannerProps) {
	const tint = errorBannerTint[severity];
	return (
		<HStack
			alignment="top"
			spacing={10}
			modifiers={[
				padding({ all: 12 }),
				frame({ maxWidth: Infinity, alignment: 'leading' }),
				background(
					withOpacity(tint, 0.12),
					shapes.roundedRectangle({ cornerRadius: Radius.nested, roundedCornerStyle: 'continuous' })
				),
				strokeBorder({
					color: withOpacity(tint, 0.18),
					style: { lineWidth: 1 },
					shape: 'roundedRectangle',
					cornerRadius: Radius.nested
				}),
				accessibilityElement('combine'),
				accessibilityLabel(errorBannerAccessibilityPrefix[severity] + message)
			]}
		>
			<Image
				systemName="exclamationmark.triangle.fill"
				modifiers={[foregroundStyle(tint), accessibilityHidden(true)]}
			/>
			<Text
				modifiers={[
					font({ textStyle: 'subheadline' }),
					foregroundStyle(tint),
					multilineTextAlignment('leading'),
					fixedSize({ horizontal: false, vertical: true })
				]}
			>
				{message}
			</Text>
			<Spacer minLength={0} />
			{retry ? (
				<Button
					onPress={retry}
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'medium' }),
						buttonStyle('borderless')
					]}
				>
					<Text>Retry</Text>
				</Button>
			) : null}
		</HStack>
	);
}
