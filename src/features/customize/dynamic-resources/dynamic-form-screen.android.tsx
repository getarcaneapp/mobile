/** Android rendering of `DynamicCreateFormView` (DynamicResourceViews.swift). */
import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { AndroidToolbar } from '@/features/settings/shared/android-toolbar';
import { M3Section, SwitchRow } from '@/features/settings/shared/android-material';
import { colors, systemColors } from '@/theme/colors';
import { FormPicker, FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import type { BackendFormField } from './dynamic-resource';
import { useDynamicForm, type DynamicFormModel } from './use-dynamic-form';

function FieldView({ model, field }: { model: DynamicFormModel; field: BackendFormField }) {
	const text = model.value(field.id);
	const onChangeText = (value: string) => model.setValue(field.id, value);
	switch (field.type.kind) {
		case 'toggle':
			return (
				<SwitchRow
					title={field.label}
					value={model.toggle(field.id)}
					onValueChange={(isOn) => model.setToggle(field.id, isOn)}
				/>
			);
		case 'choice':
			return (
				<FormPicker
					title={field.label}
					selection={text}
					onSelectionChange={onChangeText}
					options={field.type.options.map((option) => ({ label: option, value: option }))}
				/>
			);
		case 'secure':
			return (
				<FormSecureField
					title={field.label}
					placeholder={model.placeholder(field, field.required ? 'Required' : 'Optional')}
					text={text}
					onChangeText={onChangeText}
				/>
			);
		case 'multiline':
			return (
				<FormTextField
					title={field.label}
					placeholder={model.placeholder(field, 'Value')}
					text={text}
					onChangeText={onChangeText}
					autocapitalization="never"
					autocorrectionDisabled
					axis="vertical"
					lineLimit={{ min: 5, max: 12 }}
				/>
			);
		case 'number':
			return (
				<FormTextField
					title={field.label}
					placeholder={field.placeholder === '' ? '0' : field.placeholder}
					text={text}
					onChangeText={onChangeText}
					keyboardType="numeric"
					autocapitalization="never"
					autocorrectionDisabled
				/>
			);
		case 'text':
			return (
				<FormTextField
					title={field.label}
					placeholder={field.placeholder === '' ? 'Value' : field.placeholder}
					text={text}
					onChangeText={onChangeText}
					autocapitalization="never"
					autocorrectionDisabled
				/>
			);
	}
}

export function DynamicFormScreen() {
	const model = useDynamicForm();
	return (
		<>
			<Stack.Screen options={{ title: model.title }} />
			<AndroidToolbar
				items={[
					model.isSaving
						? { kind: 'spinner', id: 'save', label: 'Saving...' }
						: {
								kind: 'button',
								id: 'save',
								icon: 'checkmark',
								label: 'Save',
								disabled: model.saveDisabled,
								onPress: () => void model.save()
							}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section>
					{model.fields.map((field) => (
						<FieldView key={field.id} model={model} field={field} />
					))}
				</M3Section>
				{model.errorMessage !== undefined ? (
					<M3Section>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
							<Icon name="exclamationmark.triangle" size={20} color={systemColors.red} />
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
