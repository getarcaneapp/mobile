import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';

type StackScreenOptions = NonNullable<ComponentProps<typeof Stack>['screenOptions']>;

/** Default native-stack chrome: large titles + accent-tinted bar buttons on iOS. */
export function useStackScreenOptions(): StackScreenOptions {
	const accent = useAccentColor();
	return {
		headerLargeTitleEnabled: Platform.OS === 'ios',
		headerTransparent: Platform.OS === 'ios',
		// Material 3 top app bar: onSurface title and navigation icon on a surface bar with no divider.
		headerTintColor: Platform.OS === 'ios' ? accent : colors.label,
		// UIKit tint only colors bar buttons; React Navigation would also tint the titles.
		headerTitleStyle: { color: colors.label },
		headerLargeTitleStyle: Platform.OS === 'ios' ? { color: colors.label } : undefined,
		headerStyle:
			Platform.OS === 'android' ? { backgroundColor: colors.systemBackground } : undefined,
		headerShadowVisible: Platform.OS === 'ios' ? undefined : false,
		contentStyle:
			Platform.OS === 'android' ? { backgroundColor: colors.systemBackground } : undefined,
		headerBackButtonDisplayMode: 'minimal'
	} as StackScreenOptions;
}
