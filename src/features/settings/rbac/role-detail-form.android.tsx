import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { FormTextField, FormValueRow } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';

import { M3Section } from '../shared/android-material';
import { FormErrorSection } from '../shared/form-error-section';
import { SettingsSaveBar, settingsSaveBarHeight } from '../shared/settings-save-bar';

import { PermissionPicker } from './permission-picker';
import type { RoleDetailModel } from './use-role-detail';

export function RoleDetailForm({ model }: { model: RoleDetailModel }) {
	const { isReadOnly } = model;
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen
				options={{
					title: model.title,
					headerSearchBarOptions: {
						placeholder: 'Search permissions',
						onChangeText: (event) => model.setSearch(event.nativeEvent.text),
						onClose: () => model.setSearch('')
					}
				}}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: (isReadOnly ? 0 : settingsSaveBarHeight) + 16 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section
					title="Role Info"
					footer={isReadOnly ? undefined : 'Use a short name that explains who this role is for.'}
				>
					{isReadOnly ? (
						<>
							<FormValueRow title="Name" value={model.name} />
							{model.description !== '' ? (
								<FormValueRow title="Description" value={model.description} />
							) : null}
						</>
					) : (
						<>
							<FormTextField
								title="Name"
								placeholder="Deploy Operator"
								text={model.name}
								onChangeText={model.setName}
							/>
							<FormTextField
								title="Description"
								placeholder="Optional"
								text={model.description}
								onChangeText={model.setDescription}
								axis="vertical"
								lineLimit={{ min: 2, max: 4 }}
							/>
						</>
					)}
				</M3Section>
				{model.manifest ? (
					<PermissionPicker
						manifest={model.manifest}
						selected={model.selectedPermissions}
						onSetPermissions={model.setPermissions}
						isReadOnly={isReadOnly}
						search={model.search}
					/>
				) : (
					<View style={{ padding: 24, alignItems: 'center' }}>
						<ActivityIndicator color={m3.primary as string} />
					</View>
				)}
				<Text
					style={[
						m3Type.bodySmall,
						{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 12 }
					]}
				>
					{isReadOnly
						? 'Built-in roles cannot be edited.'
						: 'Select which actions this role can perform.'}
				</Text>
				<FormErrorSection message={model.errorMessage} />
			</ScrollView>
			<SettingsSaveBar
				isPresented={!isReadOnly}
				reservesTabBarSpace={model.mode !== 'create'}
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				canSave={model.canSave}
				saveAccessibilityLabel={model.mode === 'create' ? 'Create' : 'Save'}
				onSave={model.save}
				onRevert={model.revertChanges}
			/>
		</View>
	);
}
