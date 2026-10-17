/**
 * Port of `DemoBanner` (Android): a Material 3 tonal card with the live
 * countdown (orange under a minute) and a tonal End button.
 *
 * Standalone (RN view).
 */
import { Pressable, Text, View } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';

import { formatRemaining, useRemainingSeconds, type DemoBannerProps } from './demo-banner.types';
import { m3 } from './material-colors';
import { m3Type } from './type-scale';

export function DemoBanner({ endsAt, onEnd }: DemoBannerProps) {
	const brand = useAccentColor();
	const remaining = useRemainingSeconds(endsAt);
	const isLowTime = remaining < 60;
	return (
		<View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 }}>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 12,
					paddingHorizontal: 12,
					paddingVertical: 10,
					borderRadius: Radius.card,
					backgroundColor: m3.surfaceContainerHigh
				}}
			>
				<View
					style={{
						width: 28,
						height: 28,
						borderRadius: 14,
						backgroundColor: withOpacity(brand, 0.12),
						alignItems: 'center',
						justifyContent: 'center'
					}}
				>
					<Icon name="sparkles" size={16} color={brand} />
				</View>
				<View style={{ flex: 1, gap: 1 }}>
					<Text style={[m3Type.titleSmall, { color: colors.label }]}>Demo Mode</Text>
					<Text
						accessibilityLiveRegion="polite"
						style={[
							m3Type.bodySmall,
							{
								color: isLowTime ? systemColors.orange : colors.secondaryLabel,
								fontVariant: ['tabular-nums']
							}
						]}
					>
						{formatRemaining(remaining)}
					</Text>
				</View>
				<Pressable
					onPress={onEnd}
					accessibilityRole="button"
					android_ripple={{ color: withOpacity(brand, 0.24) }}
					style={{
						minWidth: 48,
						minHeight: 40,
						paddingHorizontal: 16,
						borderRadius: 20,
						overflow: 'hidden',
						justifyContent: 'center',
						backgroundColor: withOpacity(brand, 0.18)
					}}
				>
					<Text style={[m3Type.labelLarge, { color: brand, textAlign: 'center' }]}>End</Text>
				</Pressable>
			</View>
		</View>
	);
}
