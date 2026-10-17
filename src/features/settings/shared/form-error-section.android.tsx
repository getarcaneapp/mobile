import { Text, View } from 'react-native';

import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

export function FormErrorSection({ message }: { message: string | undefined }) {
	if (message === undefined) return null;
	return (
		<View style={{ paddingTop: 16 }}>
			<MaterialListGroup>
				<View
					accessibilityRole="alert"
					style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 }}
				>
					<Icon name="exclamationmark.triangle" size={20} color={m3.error} />
					<Text style={[m3Type.bodyMedium, { flex: 1, color: m3.error }]}>{message}</Text>
				</View>
			</MaterialListGroup>
		</View>
	);
}
