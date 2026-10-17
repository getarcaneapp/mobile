/**
 * Port of `RoleDetailView` (RolesView.swift) in its pushed modes: `.edit` for
 * custom roles and `.readOnly` for built-ins.
 */
import { Host } from '@/ui/host';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { SettingsSaveBar } from '../shared/settings-save-bar';

import { RoleDetailForm } from './role-detail-form';
import { useRoleDetail } from './use-role-detail';

export function RoleDetailScreen() {
	const model = useRoleDetail('readOnly');
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen
				options={{
					title: model.title,
					headerLargeTitleEnabled: false,
					headerSearchBarOptions: {
						placeholder: 'Search permissions',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearch(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearch('')
					}
				}}
			/>
			<Host style={{ flex: 1 }}>
				<RoleDetailForm model={model} />
			</Host>
			<SettingsSaveBar
				isPresented={!model.isReadOnly}
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				canSave={model.canSave}
				saveAccessibilityLabel="Save"
				onSave={model.save}
				onRevert={model.revertChanges}
			/>
		</View>
	);
}
