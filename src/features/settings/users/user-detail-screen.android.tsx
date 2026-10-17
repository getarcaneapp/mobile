import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormTextField, FormValueRow } from '@/ui/components/form-fields';
import { MaterialListItem } from '@/ui/material/list';

import { M3Section, SwitchRow } from '../shared/android-material';
import { FormErrorSection } from '../shared/form-error-section';
import { SettingsSaveBar, settingsSaveBarHeight } from '../shared/settings-save-bar';

import { useUserDetail } from './use-user-detail';

export function UserDetailScreen() {
	const model = useUserDetail();
	const { user } = model;

	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ title: model.title }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: settingsSaveBarHeight + 16 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Identity">
					<FormValueRow title="Username" value={user?.username ?? ''} />
					<FormTextField
						title="Email"
						placeholder="Optional"
						text={model.email}
						onChangeText={model.setEmail}
						keyboardType="email-address"
						autocapitalization="never"
						autocorrectionDisabled
					/>
					<FormTextField
						title="Display Name"
						placeholder="Optional"
						text={model.displayName}
						onChangeText={model.setDisplayName}
						autocapitalization="words"
					/>
				</M3Section>
				<M3Section title="Access">
					{model.supportsV2 ? (
						<MaterialListItem
							headline="Role Assignments"
							supporting="Manage global and per-environment roles"
							icon="person.crop.rectangle.stack"
							iconColor={systemColors.indigo}
							onPress={model.openRoleAssignments}
						/>
					) : (
						<SwitchRow
							title="Administrator"
							value={model.isAdmin}
							onValueChange={model.setIsAdmin}
						/>
					)}
				</M3Section>
				<FormErrorSection message={model.errorMessage} />
			</ScrollView>
			<SettingsSaveBar
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				onSave={model.save}
				onRevert={model.revertChanges}
			/>
		</View>
	);
}
