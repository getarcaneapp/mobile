/** Port of `AccountPreferencesView` (Views/Settings/AccountPreferencesView.swift). */
import { Host } from '@/ui/host';
import { Form, Picker, Section, Text } from '@expo/ui/swift-ui';
import { disabled, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { systemColors } from '@/theme/colors';
import { SettingsRow } from '@/ui/settings-row';

import { iconCatalogs, useAccountPreferences, type IconCatalog } from './use-account-preferences';

export function AccountPreferencesScreen() {
	const model = useAccountPreferences();
	return (
		<>
			<Stack.Screen options={{ title: 'Preferences', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<Form>
					<Section footer={<Text>Project and container icons come from this catalog.</Text>}>
						<Picker
							label={
								<SettingsRow
									title="Icon Catalog"
									systemImage="square.grid.2x2.fill"
									color={systemColors.purple}
								/>
							}
							selection={model.iconCatalog}
							onSelectionChange={(value: IconCatalog) => model.setIconCatalog(value)}
							modifiers={[pickerStyle('menu'), disabled(model.isSaving)]}
						>
							{iconCatalogs.map((catalog) => (
								<Text key={catalog.value} modifiers={[tag(catalog.value)]}>
									{catalog.title}
								</Text>
							))}
						</Picker>
					</Section>
				</Form>
			</Host>
		</>
	);
}
