import { Switch, type SwitchProps } from 'react-native';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';

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
