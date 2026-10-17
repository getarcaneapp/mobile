/** Android rendering of `FederatedCredentialFormView` (FederatedCredentialFormView.swift). */
import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { m3Type } from '@/ui/components/type-scale';

import { M3Section, SwitchRow } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { DatePickerRow } from '../shared/date-picker-row';
import { useFederatedCredentialFormModel } from './use-federated-credential-form';

const plain = { autocapitalization: 'never', autocorrectionDisabled: true } as const;

export function FederatedCredentialFormScreen() {
	const model = useFederatedCredentialFormModel();
	const { form, update } = model;
	return (
		<>
			<Stack.Screen
				options={{
					title: model.title,
					gestureEnabled: !model.saving,
					headerBackVisible: !model.saving
				}}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'confirm',
						icon: 'checkmark',
						label: model.confirmTitle,
						disabled: model.confirmDisabled,
						onPress: model.save
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
				pointerEvents={model.saving ? 'none' : 'auto'}
			>
				<M3Section title="Credential">
					<FormTextField
						title="Name"
						placeholder=""
						text={form.name}
						onChangeText={(name) => update({ name })}
						{...plain}
					/>
					<FormTextField
						title="Description"
						placeholder=""
						text={form.description}
						onChangeText={(description) => update({ description })}
						axis="vertical"
						{...plain}
					/>
					<SwitchRow
						title="Enabled"
						value={form.enabled}
						onValueChange={(enabled) => update({ enabled })}
					/>
				</M3Section>
				<M3Section title="Trust rule">
					<FormTextField
						title="Issuer URL"
						placeholder=""
						text={form.issuerUrl}
						onChangeText={(issuerUrl) => update({ issuerUrl })}
						keyboardType="url"
						{...plain}
					/>
					<FormTextField
						title="Audiences, one per line"
						placeholder=""
						text={form.audiences}
						onChangeText={(audiences) => update({ audiences })}
						axis="vertical"
						{...plain}
					/>
					<FormTextField
						title="Subject claim"
						placeholder=""
						text={form.subjectClaim}
						onChangeText={(subjectClaim) => update({ subjectClaim })}
						{...plain}
					/>
					<FormPicker
						title="Match type"
						selection={form.matchType}
						onSelectionChange={(matchType) => update({ matchType })}
						options={[
							{ label: 'Exact', value: 'exact' },
							{ label: 'Glob', value: 'glob' }
						]}
					/>
					<FormTextField
						title="Subject match"
						placeholder=""
						text={form.subjectMatch}
						onChangeText={(subjectMatch) => update({ subjectMatch })}
						axis="vertical"
						{...plain}
					/>
				</M3Section>
				<M3Section
					title="Access"
					footer={
						model.expirationLocked
							? 'This server allows changing an expiration date but does not support removing it.'
							: undefined
					}
				>
					<FormPicker
						title="Role"
						selection={form.roleId}
						onSelectionChange={(roleId) => update({ roleId })}
						options={[
							{ label: 'Choose role', value: '' },
							...model.roles.map((role) => ({ label: role.name, value: role.id }))
						]}
					/>
					<FormPicker
						title="Environment"
						selection={form.environmentId}
						onSelectionChange={(environmentId) => update({ environmentId })}
						options={[
							{ label: 'Global', value: '' },
							...model.environments.map((environment) => ({
								label: environment.name ?? environment.id,
								value: environment.id
							}))
						]}
					/>
					<FormTextField
						title="Token lifetime in seconds"
						placeholder="Seconds"
						text={form.tokenTtlSeconds}
						onChangeText={(tokenTtlSeconds) => update({ tokenTtlSeconds })}
						keyboardType="numeric"
					/>
					<SwitchRow
						title="Expires"
						value={form.expires}
						disabled={model.expirationLocked}
						onValueChange={(expires) => update({ expires })}
					/>
					{form.expires ? (
						<DatePickerRow
							title="Expiration"
							value={form.expiresAt}
							includesTime
							onChange={(expiresAt) => update({ expiresAt })}
						/>
					) : null}
				</M3Section>
				{model.errorMessage ? (
					<M3Section>
						<Text style={[m3Type.bodyMedium, { color: systemColors.red, padding: 16 }]}>
							{model.errorMessage}
						</Text>
					</M3Section>
				) : null}
				{model.validationMessage ? (
					<M3Section>
						<View style={{ padding: 16 }}>
							<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
								{model.validationMessage}
							</Text>
						</View>
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}
