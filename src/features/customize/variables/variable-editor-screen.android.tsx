import { Stack } from 'expo-router';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { AndroidToolbar } from '@/features/settings/shared/android-toolbar';
import { CenteredMessage, M3Section, SwitchRow } from '@/features/settings/shared/android-material';
import { colors, systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { useVariableEditor } from './use-variable-editor';

export function VariableEditorScreen() {
	const model = useVariableEditor();
	return (
		<>
			<Stack.Screen options={{ title: model.title, gestureEnabled: !model.isSaving }} />
			<AndroidToolbar
				items={[
					model.isSaving
						? { kind: 'spinner', id: 'save', label: 'Saving' }
						: {
								kind: 'button',
								id: 'save',
								icon: 'checkmark',
								label: 'Save',
								disabled: !model.canSave,
								onPress: () => void model.save()
							}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Variable" footer={model.variableFooter}>
					<FormTextField
						title="Key"
						placeholder="DATABASE_URL"
						text={model.key}
						onChangeText={model.setKey}
						autocapitalization="characters"
						autocorrectionDisabled
					/>
					<SwitchRow title="Secret" value={model.isSecret} onValueChange={model.setIsSecret} />
					<View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
						<TextInput
							value={model.value}
							onChangeText={model.setValue}
							placeholder={
								model.isSecret && model.isEditing
									? 'Leave blank to keep the current secret'
									: 'Value'
							}
							placeholderTextColor={colors.secondaryLabel}
							accessibilityLabel="Value"
							secureTextEntry={model.isSecret}
							autoComplete={model.isSecret ? 'password' : 'off'}
							multiline={!model.isSecret}
							numberOfLines={model.isSecret ? 1 : 5}
							autoCapitalize="none"
							autoCorrect={false}
							style={[
								m3Type.bodyLarge,
								{
									color: colors.label,
									borderWidth: 1,
									borderColor: m3.outline,
									borderRadius: 4,
									paddingHorizontal: 12,
									paddingVertical: 10,
									minHeight: 48,
									maxHeight: 140,
									textAlignVertical: 'top'
								}
							]}
						/>
					</View>
				</M3Section>

				<M3Section
					title="Scope"
					footer="Scoped variables are materialized only into the selected environments."
				>
					<SwitchRow
						title="All Environments"
						value={model.allEnvironments}
						onValueChange={model.setAllEnvironments}
					/>
					{!model.allEnvironments ? (
						model.environmentOptions.length === 0 ? (
							<View style={{ minHeight: 160 }}>
								<CenteredMessage
									icon="server.rack"
									title="No Environments Available"
									message="Load environments or choose All Environments."
								/>
							</View>
						) : (
							model.environmentOptions.map((environment) => (
								<SwitchRow
									key={environment.id}
									title={environment.name}
									value={model.isEnvironmentSelected(environment.id)}
									onValueChange={(isOn) => model.setEnvironmentSelected(environment.id, isOn)}
								/>
							))
						)
					) : null}
				</M3Section>

				{model.errorMessage !== undefined ? (
					<M3Section>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
							<Icon name="exclamationmark.triangle.fill" size={20} color={systemColors.red} />
							<Text style={[m3Type.bodyLarge, { color: systemColors.red, flex: 1 }]}>
								{model.errorMessage}
							</Text>
						</View>
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}
