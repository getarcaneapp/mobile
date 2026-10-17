import { Form, Label, Section, Text, Toggle } from '@expo/ui/swift-ui';
import { Host } from '@/ui/host';
import { disabled, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import {
	FormNumberField,
	FormPicker,
	FormSecureField,
	FormTextField
} from '@/ui/components/form-fields';

import { SettingsSaveBar, SettingsSaveBarSpacer } from '../shared/settings-save-bar';
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
		<View style={{ flex: 1 }}>
			<Stack.Screen
				options={{
					title: 'Authentication',
					headerLargeTitleEnabled: false,
					headerTransparent: false
				}}
			/>
			<Host style={{ flex: 1 }}>
				<Form>
					<Section
						header={<Label title="Local Authentication" systemImage="person.badge.key" />}
						footer={
							<Text>
								Session length in minutes (15–525600). Stronger policies require more complex local
								passwords.
							</Text>
						}
					>
						<Toggle
							label="Local Auth Enabled"
							isOn={form.authLocalEnabled}
							onIsOnChange={(isOn) => update('authLocalEnabled', isOn)}
						/>
						<FormNumberField
							title="Session Timeout"
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
					</Section>

					<Section
						header={<Label title="OIDC Provider" systemImage="lock.shield" />}
						footer={
							oidcEnvForced ? (
								<Label
									title="OIDC is managed by server environment variables and can't be edited here."
									systemImage="lock.fill"
								/>
							) : undefined
						}
						modifiers={[disabled(oidcEnvForced)]}
					>
						<Toggle
							label="OIDC Enabled"
							isOn={form.oidcEnabled}
							onIsOnChange={(isOn) => update('oidcEnabled', isOn)}
						/>
						<FormTextField
							title="Provider Name"
							disabled={oidcEnvForced}
							placeholder="Okta"
							text={form.oidcProviderName}
							onChangeText={(text) => update('oidcProviderName', text)}
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<FormTextField
							title="Provider Logo URL"
							disabled={oidcEnvForced}
							placeholder="https://..."
							text={form.oidcProviderLogoUrl}
							onChangeText={(text) => update('oidcProviderLogoUrl', text)}
							keyboardType="url"
							textContentType="URL"
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<FormTextField
							title="Issuer URL"
							disabled={oidcEnvForced}
							placeholder="https://issuer.example.com"
							text={form.oidcIssuerUrl}
							onChangeText={(text) => update('oidcIssuerUrl', text)}
							keyboardType="url"
							textContentType="URL"
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<FormTextField
							title="Client ID"
							disabled={oidcEnvForced}
							placeholder="OIDC client ID"
							text={form.oidcClientId}
							onChangeText={(text) => update('oidcClientId', text)}
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<FormSecureField
							title="Client Secret"
							disabled={oidcEnvForced}
							placeholder="OIDC client secret"
							text={form.oidcClientSecret}
							onChangeText={(text) => update('oidcClientSecret', text)}
						/>
						<FormTextField
							title="Scopes"
							disabled={oidcEnvForced}
							placeholder="openid email profile"
							text={form.oidcScopes}
							onChangeText={(text) => update('oidcScopes', text)}
							autocapitalization="never"
							autocorrectionDisabled
							layout="stacked"
						/>
					</Section>

					<Section
						title="OIDC Options"
						footer={
							<Text>
								Groups Claim is the token claim read for group memberships. Map groups to roles in
								the Arcane web app.
							</Text>
						}
						modifiers={[disabled(oidcEnvForced)]}
					>
						<FormTextField
							title="Groups Claim"
							disabled={oidcEnvForced}
							placeholder="groups"
							text={form.oidcGroupsClaim}
							onChangeText={(text) => update('oidcGroupsClaim', text)}
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<Toggle
							label="Skip TLS Verify"
							isOn={form.oidcSkipTlsVerify}
							onIsOnChange={(isOn) => update('oidcSkipTlsVerify', isOn)}
						/>
						<Toggle
							label="Auto-Redirect to Provider"
							isOn={form.oidcAutoRedirectToProvider}
							onIsOnChange={(isOn) => update('oidcAutoRedirectToProvider', isOn)}
						/>
						<Toggle
							label="Merge Accounts"
							isOn={form.oidcMergeAccounts}
							onIsOnChange={(isOn) => update('oidcMergeAccounts', isOn)}
						/>
					</Section>

					{model.errorMessage ? (
						<Section>
							<Label
								title={model.errorMessage}
								systemImage="exclamationmark.triangle"
								modifiers={[foregroundStyle(systemColors.red)]}
							/>
						</Section>
					) : null}
					<SettingsSaveBarSpacer />
				</Form>
			</Host>
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
