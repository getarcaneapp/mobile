import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';

export const canUseLiquidGlass =
	Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

type Props = {
	children?: ReactNode;
	style?: StyleProp<ViewStyle>;
	tint?: ColorValue;
	interactive?: boolean;
};

export function GlassSurface({ children, style, tint, interactive }: Props) {
	if (canUseLiquidGlass) {
		return (
			<GlassView style={style} tintColor={tint} isInteractive={interactive}>
				{children}
			</GlassView>
		);
	}
	if (Platform.OS === 'ios') {
		return (
			<BlurView tint="systemMaterial" intensity={100} style={[{ overflow: 'hidden' }, style]}>
				{children}
			</BlurView>
		);
	}
	return (
		<View style={[{ backgroundColor: colors.secondarySystemGroupedBackground }, style]}>
			{children}
		</View>
	);
}
