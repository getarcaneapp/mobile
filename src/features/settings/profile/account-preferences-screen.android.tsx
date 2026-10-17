import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { colors } from '@/theme/colors';

import { M3Section, RadioGroup } from '../shared/android-material';
import { iconCatalogs, useAccountPreferences } from './use-account-preferences';

export function AccountPreferencesScreen() {
	const model = useAccountPreferences();
	return (
		<>
			<Stack.Screen options={{ title: 'Preferences' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<M3Section
					title="Icon Catalog"
					footer="Project and container icons come from this catalog."
				>
					<View
						pointerEvents={model.isSaving ? 'none' : 'auto'}
						accessibilityState={{ disabled: model.isSaving }}
						style={{ opacity: model.isSaving ? 0.5 : 1 }}
					>
						<RadioGroup
							options={iconCatalogs}
							selection={model.iconCatalog}
							onSelect={model.setIconCatalog}
						/>
					</View>
				</M3Section>
			</ScrollView>
		</>
	);
}
