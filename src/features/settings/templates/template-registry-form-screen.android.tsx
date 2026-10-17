/** Android rendering of `TemplateRegistryFormView` (TemplateRegistryFormView.swift). */
import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { ToastHost } from '@/ui/toast';

import { M3Section, SwitchRow } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { SettingsSaveBar, settingsSaveBarHeight } from '../shared/settings-save-bar';

import { useTemplateRegistryForm } from './use-template-registry-form';

export function TemplateRegistryFormScreen() {
	const model = useTemplateRegistryForm();
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
				<M3Section title="Template Registry">
					<FormTextField
						title="Name"
						placeholder="Company templates"
						text={draft.name}
						onChangeText={(name) => update({ name })}
					/>
					<FormTextField
						title="URL"
						placeholder="https://example.com/templates.json"
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
					<SwitchRow
						title="Enabled"
						value={draft.enabled}
						onValueChange={(enabled) => update({ enabled })}
					/>
				</M3Section>
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
