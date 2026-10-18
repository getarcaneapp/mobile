import { Host } from '@/ui/host';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import {
	Button,
	ContentUnavailableView,
	Form,
	Label,
	NavigationStack,
	ProgressView,
	SecureField,
	Section,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem,
	useNativeState
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	disabled,
	foregroundStyle,
	lineLimit,
	navigationBarTitleDisplayMode,
	navigationTitle,
	textContentType,
	textInputAutocapitalization
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { BoundTextField } from '@/features/settings/shared/swiftui-text-field';
import { systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';
import { ToastHost } from '@/ui/toast';

import { useVariableEditor } from './use-variable-editor';

function BoundSecureField({
	placeholder,
	value,
	onChangeText
}: {
	placeholder: string;
	value: string;
	onChangeText: (text: string) => void;
}) {
	const state = useNativeState(value);
	useEffect(() => {
		if (state.get() !== value) state.set(value);
	}, [state, value]);
	return (
		<SecureField
			text={state}
			placeholder={placeholder}
			onTextChange={onChangeText}
			modifiers={[textContentType('password')]}
		/>
	);
}

export function VariableEditorScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useVariableEditor();
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ gestureEnabled: !model.isSaving }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[navigationTitle(model.title), navigationBarTitleDisplayMode('inline')]}
						>
							<Section title="Variable" footer={<Text>{model.variableFooter}</Text>}>
								<FormTextField
									title="Key"
									placeholder="DATABASE_URL"
									text={model.key}
									onChangeText={model.setKey}
									autocapitalization="characters"
									autocorrectionDisabled
								/>
								<Toggle label="Secret" isOn={model.isSecret} onIsOnChange={model.setIsSecret} />
								{model.isSecret ? (
									<BoundSecureField
										placeholder={
											model.isEditing ? 'Leave blank to keep the current secret' : 'Value'
										}
										value={model.value}
										onChangeText={model.setValue}
									/>
								) : (
									<BoundTextField
										placeholder="Value"
										value={model.value}
										onChangeText={model.setValue}
										axis="vertical"
										modifiers={[
											lineLimit({ min: 1, max: 5 }),
											textInputAutocapitalization('never'),
											autocorrectionDisabled()
										]}
									/>
								)}
							</Section>

							<Section
								title="Scope"
								footer={
									<Text>
										Scoped variables are materialized only into the selected environments.
									</Text>
								}
							>
								<Toggle
									label="All Environments"
									isOn={model.allEnvironments}
									onIsOnChange={model.setAllEnvironments}
								/>
								{!model.allEnvironments ? (
									model.environmentOptions.length === 0 ? (
										<ContentUnavailableView
											title="No Environments Available"
											systemImage="server.rack"
											description="Load environments or choose All Environments."
										/>
									) : (
										model.environmentOptions.map((environment) => (
											<Toggle
												key={environment.id}
												label={environment.name}
												isOn={model.isEnvironmentSelected(environment.id)}
												onIsOnChange={(isOn) => model.setEnvironmentSelected(environment.id, isOn)}
											/>
										))
									)
								) : null}
							</Section>

							{model.errorMessage !== undefined ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle.fill"
										modifiers={[foregroundStyle(systemColors.red)]}
									/>
								</Section>
							) : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label="Cancel"
									onPress={model.cancel}
									modifiers={[disabled(model.isSaving), ...toolbarSymbol]}
								/>
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								{model.isSaving ? (
									<ProgressView />
								) : (
									<Button
										label="Save"
										onPress={() => void model.save()}
										modifiers={[disabled(!model.canSave), ...toolbarSymbol]}
									/>
								)}
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
