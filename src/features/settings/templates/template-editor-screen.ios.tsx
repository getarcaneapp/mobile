import { Host } from '@/ui/host';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import {
	Button,
	Form,
	Label,
	NavigationDestination,
	NavigationLink,
	NavigationStack,
	RNHostView,
	Section,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	disabled,
	foregroundStyle,
	frame,
	navigationBarTitleDisplayMode,
	navigationTitle
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { DeleteConfirmationHost } from '@/ui/components/delete-confirmation';
import { FormTextField } from '@/ui/components/form-fields';
import { ToastHost } from '@/ui/toast';

import { CodeEditor } from '@/ui/components/code-editor';
import {
	templateEditorConfirmationHost,
	useTemplateEditor,
	type TemplateEditorModel
} from './use-template-editor';

function FileEditor({
	model,
	isEnvironment
}: {
	model: TemplateEditorModel;
	isEnvironment: boolean;
}) {
	return (
		<VStack
			modifiers={[
				frame({ maxWidth: Infinity, maxHeight: Infinity }),
				navigationTitle(isEnvironment ? '.env' : 'compose.yml'),
				navigationBarTitleDisplayMode('inline')
			]}
		>
			<RNHostView>
				<View style={{ flex: 1 }}>
					<CodeEditor
						text={isEnvironment ? model.fields.environment : model.fields.compose}
						onChangeText={(text) =>
							model.update(isEnvironment ? { environment: text } : { compose: text })
						}
						language={isEnvironment ? 'env' : 'yaml'}
						readOnly={model.readOnly}
						accessibilityLabel={isEnvironment ? '.env' : 'compose.yml'}
					/>
				</View>
			</RNHostView>
		</VStack>
	);
}

export function TemplateEditorScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useTemplateEditor();

	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ gestureEnabled: !model.dismissDisabled }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								disabled(model.isSaving),
								navigationTitle(model.title),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							{model.isLoaded ? (
								<>
									{!model.isDefaults ? (
										<Section title="Template">
											<FormTextField
												title="Name"
												placeholder="My template"
												text={model.fields.name}
												onChangeText={(name) => model.update({ name })}
											/>
											<FormTextField
												title="Description"
												placeholder="Optional"
												text={model.fields.description}
												onChangeText={(description) => model.update({ description })}
												axis="vertical"
												lineLimit={{ min: 2, max: 4 }}
											/>
										</Section>
									) : null}
									<Section
										header={<Text>Files</Text>}
										footer={
											model.isDefaults ? (
												<Text>
													Defaults provide the starting Compose and environment files for new
													projects.
												</Text>
											) : undefined
										}
									>
										<NavigationLink value="compose">
											<Text>Compose file</Text>
										</NavigationLink>
										<NavigationLink value="env">
											<Text>Environment variables</Text>
										</NavigationLink>
									</Section>
								</>
							) : model.errorMessage === undefined ? (
								<ArcaneLoadingViewSwiftUI label="Loading template…" />
							) : null}
							{model.sessionChanged ? (
								<Section>
									<Label
										title="The connection changed. Close this editor and reopen it on the intended server before saving."
										systemImage="exclamationmark.triangle"
										modifiers={[foregroundStyle(systemColors.orange)]}
									/>
								</Section>
							) : null}
							{model.errorMessage !== undefined ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle"
										modifiers={[foregroundStyle(systemColors.red)]}
									/>
									{!model.isLoaded ? <Button label="Try Again" onPress={model.retry} /> : null}
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
								<Button
									label="Save"
									onPress={model.save}
									modifiers={[disabled(model.saveDisabled), ...toolbarSymbol]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
					<NavigationDestination value="compose">
						<FileEditor model={model} isEnvironment={false} />
					</NavigationDestination>
					<NavigationDestination value="env">
						<FileEditor model={model} isEnvironment />
					</NavigationDestination>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
			<DeleteConfirmationHost hostID={templateEditorConfirmationHost} />
		</View>
	);
}
