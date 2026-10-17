import { Text, View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section } from './android-material';

export function ErrorSection({ message }: { message: string }) {
	return (
		<M3Section>
			<View
				accessibilityRole="alert"
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 16,
					minHeight: 56,
					paddingHorizontal: 16,
					paddingVertical: 12
				}}
			>
				<Icon name="exclamationmark.triangle" size={22} color={systemColors.red} />
				<Text style={[m3Type.bodyLarge, { flex: 1, color: systemColors.red }]}>{message}</Text>
			</View>
		</M3Section>
	);
}
