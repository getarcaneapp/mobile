import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { colors } from '@/theme/colors';
import {
	FormNumberField,
	FormPicker,
	FormSecureField,
	FormTextField
} from '@/ui/components/form-fields';

import { ErrorSection } from '../shared/android-error-section';
import { M3Section, SwitchRow } from '../shared/android-material';
import { SettingsSaveBar, settingsSaveBarHeight } from '../shared/settings-save-bar';
import {
	AuthenticationSettingsValidation,
	passwordPolicyOptions,
	useAuthenticationSettings
} from './use-authentication-settings';

export function AuthenticationDestination() {
	const model = useAuthenticationSettings();
	const { form, update, oidcEnvForced } = model;
	const { lowerBound, upperBound } = AuthenticationSettingsValidation.sessionTimeoutMinutes;

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen options={{ title: 'Authentication' }} />
			<ScrollView
				contentContainerStyle={{ paddingBottom: settingsSaveBarHeight + 24 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section
					title="Local Authentication"
					footer="Session length in minutes (15–525600). Stronger policies require more complex local passwords."
				>
					<SwitchRow
						title="Local Auth Enabled"
						value={form.authLocalEnabled}
						onValueChange={(isOn) => update('authLocalEnabled', isOn)}
					/>
					<FormNumberField
						title="Session Timeout (minutes)"
						placeholder="1440"
						text={form.authSessionTimeout}
						onChangeText={(text) => update('authSessionTimeout', text)}
						minValue={lowerBound}
						maxValue={upperBound}
					/>
					<FormPicker
						title="Password Policy"
						selection={form.authPasswordPolicy}
						onSelectionChange={(value) => update('authPasswordPolicy', value)}
						options={passwordPolicyOptions}
					/>
				</M3Section>

				<M3Section
					title="OIDC Provider"
					footer={
						oidcEnvForced
							? "OIDC is managed by server environment variables and can't be edited here."
							: undefined
					}
				>
					<SwitchRow
						title="OIDC Enabled"
						value={form.oidcEnabled}
						disabled={oidcEnvForced}
						onValueChange={(isOn) => update('oidcEnabled', isOn)}
					/>
					<FormTextField
						title="Provider Name"
						placeholder="Okta"
						text={form.oidcProviderName}
						onChangeText={(text) => update('oidcProviderName', text)}
						autocapitalization="never"
						autocorrectionDisabled
						disabled={oidcEnvForced}
					/>
					<FormTextField
						title="Provider Logo URL"
						placeholder="https://..."
						text={form.oidcProviderLogoUrl}
						onChangeText={(text) => update('oidcProviderLogoUrl', text)}
						keyboardType="url"
						textContentType="URL"
						autocapitalization="never"
						autocorrectionDisabled
						disabled={oidcEnvForced}
					/>
					<FormTextField
						title="Issuer URL"
						placeholder="https://issuer.example.com"
						text={form.oidcIssuerUrl}
						onChangeText={(text) => update('oidcIssuerUrl', text)}
						keyboardType="url"
						textContentType="URL"
						autocapitalization="never"
						autocorrectionDisabled
						disabled={oidcEnvForced}
					/>
					<FormTextField
						title="Client ID"
						placeholder="OIDC client ID"
						text={form.oidcClientId}
						onChangeText={(text) => update('oidcClientId', text)}
						autocapitalization="never"
						autocorrectionDisabled
						disabled={oidcEnvForced}
					/>
					<FormSecureField
						title="Client Secret"
						placeholder="OIDC client secret"
						text={form.oidcClientSecret}
						onChangeText={(text) => update('oidcClientSecret', text)}
						disabled={oidcEnvForced}
					/>
					<FormTextField
						title="Scopes"
						placeholder="openid email profile"
						text={form.oidcScopes}
						onChangeText={(text) => update('oidcScopes', text)}
						autocapitalization="never"
						autocorrectionDisabled
						layout="stacked"
						disabled={oidcEnvForced}
					/>
				</M3Section>

				<M3Section
					title="OIDC Options"
					footer="Groups Claim is the token claim read for group memberships. Map groups to roles in the Arcane web app."
				>
					<FormTextField
						title="Groups Claim"
						placeholder="groups"
						text={form.oidcGroupsClaim}
						onChangeText={(text) => update('oidcGroupsClaim', text)}
						autocapitalization="never"
						autocorrectionDisabled
						disabled={oidcEnvForced}
					/>
					<SwitchRow
						title="Skip TLS Verify"
						value={form.oidcSkipTlsVerify}
						disabled={oidcEnvForced}
						onValueChange={(isOn) => update('oidcSkipTlsVerify', isOn)}
					/>
					<SwitchRow
						title="Auto-Redirect to Provider"
						value={form.oidcAutoRedirectToProvider}
						disabled={oidcEnvForced}
						onValueChange={(isOn) => update('oidcAutoRedirectToProvider', isOn)}
					/>
					<SwitchRow
						title="Merge Accounts"
						value={form.oidcMergeAccounts}
						disabled={oidcEnvForced}
						onValueChange={(isOn) => update('oidcMergeAccounts', isOn)}
					/>
				</M3Section>

				{model.errorMessage ? <ErrorSection message={model.errorMessage} /> : null}
			</ScrollView>
			<SettingsSaveBar
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				isInteractionDisabled={model.isLoading}
				onSave={() => void model.save()}
				onRevert={model.revertChanges}
			/>
		</View>
	);
}
