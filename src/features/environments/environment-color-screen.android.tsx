/** Android (Material 3) rendering of `EnvironmentColorSheet` (EnvironmentColorsView.swift). Presented as a modal. */
import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { TextButtonRow } from '@/features/settings/shared/android-material';
import { colors } from '@/theme/colors';
import { EnvironmentColorPicker } from '@/ui/components/environment-color-picker';
import { useEnvironmentColorPicker } from '@/ui/components/environment-color-picker.types';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { MaterialListGroup } from '@/ui/material/list';
import { ToastHost } from '@/ui/toast';

import { useEnvironmentColorRoute } from './environment-color-model';

export function EnvironmentColorScreen() {
	const router = useRouter();
	const route = useEnvironmentColorRoute();
	const picker = useEnvironmentColorPicker(route.environmentID);
	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen options={{ title: 'Environment Color', headerShown: true }} />
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.View>
					<Pressable
						onPress={() => router.back()}
						accessibilityRole="button"
						style={{ paddingHorizontal: 12, paddingVertical: 8 }}
					>
						<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Done</Text>
					</Pressable>
				</Stack.Toolbar.View>
			</Stack.Toolbar>
			<ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}>
				<MaterialListGroup>
					<EnvironmentColorPicker
						environmentID={route.environmentID}
						displayName={route.displayName}
					/>
					<TextButtonRow title="Reset Color" onPress={picker.reset} />
				</MaterialListGroup>
				<Text
					style={[
						m3Type.bodySmall,
						{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
					]}
				>
					Applies to this environment's name and icon in resource lists.
				</Text>
			</ScrollView>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
