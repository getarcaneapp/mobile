/**
 * React Native ports of the `CardVocabulary.swift` surfaces, for RN trees on
 * both platforms. On Android they render as Material 3 tonal containers (no
 * glass, elevation from the tonal color instead of shadows).
 *
 * Standalone (RN views).
 */
import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { GlassSurface, canUseLiquidGlass } from '@/ui/glass';

import { groupedHex, useIsDark, useReduceTransparency } from './accessibility';

/** `.floatingSurfaceShadow()` for RN views (iOS only; Android floats via elevation). */
export const floatingSurfaceShadowStyle: ViewStyle = Platform.select({
	ios: {
		shadowColor: '#000',
		shadowOpacity: 0.18,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 4 }
	},
	default: { elevation: 6 }
});

type SurfaceProps = { cornerRadius?: number; style?: StyleProp<ViewStyle>; children?: ReactNode };

/** `.dashboardCardBackground(cornerRadius:)`. */
export function DashboardCard({ cornerRadius = Radius.card, style, children }: SurfaceProps) {
	const isDark = useIsDark();
	const legacyIOS = Platform.OS === 'ios' && !canUseLiquidGlass;
	return (
		<View
			style={[
				{
					borderRadius: cornerRadius,
					borderCurve: 'continuous',
					backgroundColor: colors.secondarySystemGroupedBackground
				},
				legacyIOS && {
					shadowColor: '#000',
					shadowOpacity: 0.06,
					shadowRadius: 8,
					shadowOffset: { width: 0, height: 3 },
					// Top-edge highlight approximated with a top border.
					borderTopWidth: 1,
					borderTopColor: isDark ? '#FFFFFF12' : '#FFFFFF59'
				},
				style
			]}
		>
			{children}
		</View>
	);
}

/** Port of `GlassCardBackgroundModifier` for RN trees. */
export function GlassCard({
	cornerRadius = Radius.card,
	isHighlighted = false,
	style,
	children
}: SurfaceProps & { isHighlighted?: boolean }) {
	const isDark = useIsDark();
	const reduceTransparency = useReduceTransparency();
	const accent = useAccentColor();
	const rim = isHighlighted ? { borderWidth: 1.5, borderColor: withOpacity(accent, 0.45) } : null;

	if (canUseLiquidGlass && !reduceTransparency) {
		const wash = withOpacity(
			isDark
				? groupedHex.dark.secondarySystemGroupedBackground
				: groupedHex.light.secondarySystemGroupedBackground,
			0.78
		);
		return (
			<GlassSurface
				style={[
					{ borderRadius: cornerRadius, borderCurve: 'continuous', overflow: 'hidden' },
					style
				]}
			>
				<View
					style={{
						flexGrow: 1,
						borderRadius: cornerRadius,
						borderCurve: 'continuous',
						backgroundColor: wash,
						borderWidth: rim ? rim.borderWidth : 1,
						borderColor: rim ? rim.borderColor : isDark ? '#FFFFFF14' : '#FFFFFF80'
					}}
				>
					{children}
				</View>
			</GlassSurface>
		);
	}
	return (
		<DashboardCard cornerRadius={cornerRadius} style={[rim, style]}>
			{children}
		</DashboardCard>
	);
}

/** `.raisedChipBackground(in:)` for RN views. */
export function RaisedChip({ cornerRadius = Radius.nested, style, children }: SurfaceProps) {
	return (
		<View
			style={[
				{
					borderRadius: cornerRadius,
					borderCurve: 'continuous',
					backgroundColor: colors.tertiarySystemGroupedBackground
				},
				Platform.OS === 'ios'
					? {
							shadowColor: '#000',
							shadowOpacity: 0.15,
							shadowRadius: 3,
							shadowOffset: { width: 0, height: 1 }
						}
					: null,
				style
			]}
		>
			{children}
		</View>
	);
}
