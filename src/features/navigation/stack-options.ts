import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';

type StackScreenOptions = NonNullable<ComponentProps<typeof Stack>['screenOptions']>;

export function useStackScreenOptions(): StackScreenOptions {
	const accent = useAccentColor();
	return {
		headerLargeTitleEnabled: Platform.OS === 'ios',
		headerTransparent: Platform.OS === 'ios',
		headerTintColor: Platform.OS === 'ios' ? accent : colors.label,
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
