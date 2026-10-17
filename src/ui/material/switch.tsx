import { Switch, type SwitchProps } from 'react-native';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';

/**
 * Material 3 switch colors on the platform `Switch`: primary track with an
 * onPrimary handle when on, outlineVariant track with an outline
 * handle when off. The bare RN switch otherwise paints the theme's accent
 * (teal) handle over the primary track.
 */
export function M3Switch({ value, trackColor, thumbColor, ...props }: SwitchProps) {
	return (
		<Switch
			value={value}
			trackColor={trackColor ?? { true: m3.primary as string, false: colors.separator as string }}
			thumbColor={thumbColor ?? ((value ? m3.onPrimary : m3.outline) as string)}
			{...props}
		/>
	);
}
