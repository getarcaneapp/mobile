import { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';

type Props = {
	children?: ReactNode;
	style?: StyleProp<ViewStyle>;
	tint?: ColorValue;
	interactive?: boolean;
};

export function GlassSurface({ children, style, tint, interactive }: Props) {
	if (Platform.OS === 'ios') {
		return (
			<GlassView style={style} tintColor={tint} isInteractive={interactive}>
				{children}
			</GlassView>
		);
	}
	return (
		<View style={[{ backgroundColor: colors.secondarySystemGroupedBackground }, style]}>
			{children}
		</View>
	);
}
