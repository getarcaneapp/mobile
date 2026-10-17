import { Host } from '@/ui/host';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import {
	Button,
	Form,
	Label,
	NavigationStack,
	Section,
	Toggle,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	disabled,
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { FormPicker, FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { ToastHost } from '@/ui/toast';

import type { BackendFormField } from './dynamic-resource';
import { useDynamicForm, type DynamicFormModel } from './use-dynamic-form';

function FieldView({ model, field }: { model: DynamicFormModel; field: BackendFormField }) {
	const text = model.value(field.id);
	const onChangeText = (value: string) => model.setValue(field.id, value);
	switch (field.type.kind) {
		case 'toggle':
			return (
				<Toggle
					label={field.label}
					isOn={model.toggle(field.id)}
					onIsOnChange={(isOn) => model.setToggle(field.id, isOn)}
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
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useDynamicForm();
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[navigationTitle(model.title), navigationBarTitleDisplayMode('inline')]}
						>
							<Section>
								{model.fields.map((field) => (
									<FieldView key={field.id} model={model} field={field} />
								))}
							</Section>
							{model.errorMessage !== undefined ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle"
										modifiers={[foregroundStyle(systemColors.red)]}
									/>
								</Section>
							) : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={model.cancel} />
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label={model.isSaving ? 'Saving...' : 'Save'}
									onPress={() => void model.save()}
									modifiers={[disabled(model.saveDisabled), ...toolbarSymbol]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
