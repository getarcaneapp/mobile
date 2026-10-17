import { Color } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';

import { appearanceColors } from '@/theme/colors';

const dyn = (role: keyof typeof Color.android.dynamic, fallback: string): ColorValue =>
	(Platform.OS === 'android' ? Color.android.dynamic[role] : undefined) ?? fallback;

/** Material 3 dynamic color roles used by the Android component renderings (follow dark mode live). */
export const m3 = appearanceColors(() => ({
	primary: dyn('primary', '#6750A4'),
	onPrimary: dyn('onPrimary', '#FFFFFF'),
	primaryContainer: dyn('primaryContainer', '#EADDFF'),
	onPrimaryContainer: dyn('onPrimaryContainer', '#21005D'),
	secondaryContainer: dyn('secondaryContainer', '#E8DEF8'),
	onSecondaryContainer: dyn('onSecondaryContainer', '#1D192B'),
	error: dyn('error', '#B3261E'),
	onError: dyn('onError', '#FFFFFF'),
	errorContainer: dyn('errorContainer', '#F9DEDC'),
	onErrorContainer: dyn('onErrorContainer', '#410E0B'),
	surfaceContainerHigh: dyn('surfaceContainerHigh', '#ECE6F0'),
	surfaceContainerHighest: dyn('surfaceContainerHighest', '#E6E0E9'),
	onSurfaceVariant: dyn('onSurfaceVariant', '#49454F'),
	outline: dyn('outline', '#79747E')
}));
