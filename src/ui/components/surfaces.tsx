import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { GlassSurface } from '@/ui/glass';

import { groupedHex, useIsDark, useReduceTransparency } from './accessibility';

type SurfaceProps = { cornerRadius?: number; style?: StyleProp<ViewStyle>; children?: ReactNode };

export function DashboardCard({ cornerRadius = Radius.card, style, children }: SurfaceProps) {
	return (
		<View
			style={[
				{
					borderRadius: cornerRadius,
					borderCurve: 'continuous',
					backgroundColor: colors.secondarySystemGroupedBackground
				},
				style
			]}
		>
			{children}
		</View>
	);
}

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

	if (Platform.OS === 'ios' && !reduceTransparency) {
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
