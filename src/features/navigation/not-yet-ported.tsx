import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

export function NotYetPorted({ title }: { title: string }) {
	return (
		<>
			<Stack.Screen options={{ title }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					flexGrow: 1,
					alignItems: 'center',
					justifyContent: 'center',
					padding: 32,
					gap: 8
				}}
				style={{ backgroundColor: colors.systemGroupedBackground }}
			>
				<View style={{ alignItems: 'center', gap: 10 }}>
					<Icon name="hammer.fill" size={44} color={colors.secondaryLabel} />
					<Text style={{ fontSize: 22, fontWeight: '700', color: colors.label }}>{title}</Text>
					<Text style={{ fontSize: 15, color: colors.secondaryLabel, textAlign: 'center' }}>
						This screen hasn't been ported to the React Native app yet.
					</Text>
				</View>
			</ScrollView>
		</>
	);
}
