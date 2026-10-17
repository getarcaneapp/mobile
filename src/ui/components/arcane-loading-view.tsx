/**
 * Port of `ArcaneLoadingView` (ArcaneLoadingView.swift): the Arcane logo
 * drawing itself on a loop, with an optional caption. Use in place of a
 * spinner wherever a screen or section is loading. Falls back to a system
 * spinner with Reduce Motion on.
 *
 * Standalone (RN view, both platforms). For SwiftUI trees use
 * `ArcaneLoadingViewSwiftUI` from `arcane-loading-view-swiftui`.
 */
import { ActivityIndicator, Platform, Text, View } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';

import { useReduceMotion } from './accessibility';
import { ArcaneLogoTrace, useTraceClock } from './arcane-logo-trace';

export type ArcaneLoadingStyle = 'regular' | 'inline';

export type ArcaneLoadingViewProps = {
	label?: string;
	/** `regular`: centered logo, caption underneath. `inline`: small logo beside the caption. */
	variant?: ArcaneLoadingStyle;
};

export function ArcaneLoadingView({ label, variant = 'regular' }: ArcaneLoadingViewProps) {
	const accent = useAccentColor();
	const reduceMotion = useReduceMotion();
	const time = useTraceClock('shared', 0, !reduceMotion);
	const logoWidth = variant === 'regular' ? 56 : 22;

	const caption = label ? (
		<Text
			style={{
				color: colors.secondaryLabel,
				fontSize:
					variant === 'regular'
						? Platform.select({ ios: 15, default: 14 })
						: Platform.select({ ios: 17, default: 16 })
			}}
		>
			{label}
		</Text>
	) : null;

	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label ?? 'Loading'}
			style={{ alignItems: 'center', justifyContent: 'center' }}
		>
			{reduceMotion ? (
				<View style={{ alignItems: 'center', gap: 8 }}>
					<ActivityIndicator color={Platform.OS === 'android' ? accent : undefined} />
					{caption}
				</View>
			) : (
				<View
					style={{
						flexDirection: variant === 'regular' ? 'column' : 'row',
						alignItems: 'center',
						gap: variant === 'regular' ? 12 : 10
					}}
				>
					<ArcaneLogoTrace
						width={logoWidth}
						accent={accent}
						time={time}
						loops
						silhouetteOpacity={0.12}
					/>
					{caption}
				</View>
			)}
		</View>
	);
}
