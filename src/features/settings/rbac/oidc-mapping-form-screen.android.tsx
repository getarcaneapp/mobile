/** Android rendering of `OIDCMappingFormSheet` (OIDCRoleMappingsView.swift). Presented as a modal. */
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { colors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';

import { M3Section } from '../shared/android-material';
import { FormErrorSection } from '../shared/form-error-section';
import { SettingsSaveBar, settingsSaveBarHeight } from '../shared/settings-save-bar';

import { RolePicker, ScopeSection } from './scope-pickers';
import { useOIDCMappingForm } from './use-oidc-mapping-form';

export function OIDCMappingFormScreen() {
	const model = useOIDCMappingForm();
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ title: model.title }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: settingsSaveBarHeight + 16 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section
					title="Claim Value"
					footer="Enter the exact value from the configured OIDC claim."
				>
					<FormTextField
						title="Claim Value"
						placeholder="docker-admins"
						text={model.claimValue}
						onChangeText={model.setClaimValue}
						autocapitalization="never"
						autocorrectionDisabled
					/>
				</M3Section>
				<M3Section title="Role">
					<RolePicker
						roles={model.availableRoles}
						selection={model.roleId}
						onSelectionChange={model.setRoleId}
					/>
				</M3Section>
				<ScopeSection
					scope={model.scope}
					onScopeChange={model.setScope}
					environments={model.availableEnvironments}
					environmentId={model.environmentId}
					onEnvironmentChange={model.setEnvironmentId}
					globalFooter="Global mappings apply across every environment."
					environmentFooter="Environment mappings only apply inside the selected environment."
				/>
				<FormErrorSection message={model.errorMessage} />
			</ScrollView>
			<SettingsSaveBar
				reservesTabBarSpace={false}
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				canSave={model.canSave}
				onSave={model.save}
				onRevert={model.revertChanges}
			/>
		</View>
	);
}
