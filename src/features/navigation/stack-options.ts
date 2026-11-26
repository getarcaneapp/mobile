import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';

import { readableContentInset } from './navigation-layout';
import { useNavigationLayout } from './use-navigation-layout';

type StackScreenOptions = NonNullable<ComponentProps<typeof Stack>['screenOptions']>;

export function useStackScreenOptions(sheet = false): StackScreenOptions {
	const accent = useAccentColor();
	const { width } = useWindowDimensions();
	const inset = readableContentInset(useNavigationLayout(), width);
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
			Platform.OS === 'android'
				? { backgroundColor: colors.systemBackground, paddingHorizontal: inset }
				: sheet
					? { backgroundColor: 'transparent' }
					: undefined,
		headerBackButtonDisplayMode: 'minimal'
	} as StackScreenOptions;
}

export function useSheetStackScreenOptions(): StackScreenOptions {
	return useStackScreenOptions(true);
}
