/** Android rendering of `RegistryFormView` (RegistryFormView.swift): Material 3 form with save / revert FABs. */
import { Stack } from 'expo-router';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormPicker, FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { ToastHost } from '@/ui/toast';

import { M3Section, SwitchRow } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { SettingsSaveBar, settingsSaveBarHeight } from '../shared/settings-save-bar';

import { useRegistryForm } from './use-registry-form';

export function RegistryFormScreen() {
	const model = useRegistryForm();
	const { draft, update } = model;

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen options={{ title: model.title }} />
			<AndroidToolbar
				placement="left"
				items={[
					{ kind: 'button', id: 'cancel', icon: 'xmark', label: 'Cancel', onPress: model.cancel }
				]}
			/>
			<ScrollView
				contentContainerStyle={{ paddingBottom: settingsSaveBarHeight + 24 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section
					title="Registry Details"
					footer="Choose AWS ECR only for registries that need AWS credentials."
				>
					<FormTextField
						title="Registry URL"
						placeholder="registry.example.com"
						text={draft.url}
						onChangeText={(url) => update({ url })}
						keyboardType="url"
						textContentType="URL"
						autocapitalization="never"
						autocorrectionDisabled
					/>
					<FormTextField
						title="Description"
						placeholder="Optional"
						text={draft.description}
						onChangeText={(description) => update({ description })}
						axis="vertical"
						lineLimit={{ min: 2, max: 4 }}
					/>
					<FormPicker
						title="Type"
						selection={model.typeSelection}
						onSelectionChange={model.setType}
						options={[
							{ label: 'Generic', value: 'generic' },
							{ label: 'AWS ECR', value: 'ecr' }
						]}
					/>
					<SwitchRow
						title="Enabled"
						value={draft.enabled}
						onValueChange={(enabled) => update({ enabled })}
					/>
					<SwitchRow
						title="Insecure"
						value={draft.insecure}
						onValueChange={(insecure) => update({ insecure })}
					/>
				</M3Section>

				{!model.isAWS ? (
					<M3Section title="Credentials (optional)">
						<FormTextField
							title="Username"
							placeholder="Optional"
							text={draft.username}
							onChangeText={(username) => update({ username })}
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<FormSecureField
							title={model.isEditing ? 'New Token or Password' : 'Token or Password'}
							placeholder={model.isEditing ? 'Leave blank to keep current value' : 'Optional'}
							text={draft.token}
							onChangeText={(token) => update({ token })}
						/>
					</M3Section>
				) : (
					<M3Section title="AWS ECR">
						<FormTextField
							title="Access Key ID"
							placeholder="AKIA..."
							text={draft.awsAccessKeyId}
							onChangeText={(awsAccessKeyId) => update({ awsAccessKeyId })}
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<FormSecureField
							title={model.isEditing ? 'New Secret Access Key' : 'Secret Access Key'}
							placeholder={model.isEditing ? 'Leave blank to keep current value' : 'Required'}
							text={draft.awsSecretAccessKey}
							onChangeText={(awsSecretAccessKey) => update({ awsSecretAccessKey })}
						/>
						<FormTextField
							title="Region"
							placeholder="us-east-1"
							text={draft.awsRegion}
							onChangeText={(awsRegion) => update({ awsRegion })}
							autocapitalization="never"
							autocorrectionDisabled
						/>
					</M3Section>
				)}

				{model.supportsPost26 ? (
					<M3Section
						title="Repository Names"
						footer="Limit registry checks to these repositories, in the order shown."
					>
						{draft.repositoryNameRows.map((row) => (
							<View
								key={row.id}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									minHeight: 56,
									paddingLeft: 16,
									gap: 8
								}}
							>
								<TextInput
									value={row.value}
									onChangeText={(value) => model.updateRepositoryRow(row.id, value)}
									placeholder="owner/image"
									placeholderTextColor={colors.secondaryLabel}
									autoCapitalize="none"
									autoCorrect={false}
									style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}
								/>
								<Pressable
									onPress={() => model.removeRepositoryRow(row.id)}
									accessibilityRole="button"
									accessibilityLabel="Remove repository name"
									android_ripple={{
										color: colors.separator as string,
										borderless: true,
										radius: 20
									}}
									style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
								>
									<Icon name="minus.circle.fill" size={22} color={systemColors.red} />
								</Pressable>
							</View>
						))}
						<Pressable
							onPress={model.addRepositoryRow}
							accessibilityRole="button"
							android_ripple={{ color: colors.separator as string }}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: 16,
								minHeight: 56,
								paddingHorizontal: 16
							}}
						>
							<Icon name="plus" size={22} color={m3.primary} />
							<Text style={[m3Type.bodyLarge, { color: m3.primary }]}>Add Repository Name</Text>
						</Pressable>
					</M3Section>
				) : null}

				{model.errorMessage !== undefined ? (
					<M3Section>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
							<Icon name="exclamationmark.triangle" size={20} color={systemColors.red} />
							<Text style={[m3Type.bodyMedium, { color: systemColors.red, flex: 1 }]}>
								{model.errorMessage}
							</Text>
						</View>
					</M3Section>
				) : null}
			</ScrollView>
			<SettingsSaveBar
				hasChanges={model.hasChanges}
				isSaving={model.isLoading}
				canSave={model.canSave}
				saveAccessibilityLabel={model.saveAccessibilityLabel}
				onSave={model.save}
				onRevert={model.revertChanges}
				reservesTabBarSpace={false}
			/>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
