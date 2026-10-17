/**
 * Port of `CreateProjectView` (ProjectDetailView.swift). With the native
 * Compose editor preview the drafts open in the native editors (pushed in this
 * sheet's `NavigationStack`), and Create becomes Review.
 */
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	Label,
	NavigationDestination,
	NavigationLink,
	NavigationStack,
	Picker,
	ProgressView,
	RNHostView,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	disabled,
	font,
	foregroundStyle,
	frame,
	listRowInsets,
	navigationBarTitleDisplayMode,
	navigationTitle,
	scaleEffect,
	tag
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { encodeComposeDestination } from '@/features/compose/compose-destinations';
import { makeSessionID, useComposeSessionHost } from '@/features/compose/compose-session';
import { ComposeDestinationView } from '@/features/compose/ios/compose-destination-view.ios';
import { BoundField, plainTextInput, Sheet } from '@/features/compose/ios/compose-ui.ios';
import { DeleteConfirmationHost } from '@/ui/components/delete-confirmation';

import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { CodeEditor, type CodeEditorLanguage } from '@/ui/components/code-editor';
import { FormTextField } from '@/ui/components/form-fields';

import {
	createProjectConfirmationHost,
	useCreateProject,
	type CreateProjectModel
} from './use-create-project';

function EditorRow({
	text,
	onChangeText,
	language,
	height
}: {
	text: string;
	onChangeText: (text: string) => void;
	language: CodeEditorLanguage;
	height: number;
}) {
	return (
		<VStack
			modifiers={[frame({ height }), listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 })]}
		>
			<RNHostView>
				<View style={{ flex: 1 }}>
					<CodeEditor text={text} onChangeText={onChangeText} language={language} />
				</View>
			</RNHostView>
		</VStack>
	);
}

/** `Section("Compose · Preview")`. */
function ComposePreviewSection({
	model,
	composeSession,
	envSession
}: {
	model: CreateProjectModel;
	composeSession: string;
	envSession: string;
}) {
	return (
		<Section title="Compose · Preview">
			<NavigationLink
				value={encodeComposeDestination({
					screen: 'editor',
					binding: { session: composeSession },
					readOnly: false,
					title: ''
				})}
			>
				<Text>Edit Compose</Text>
			</NavigationLink>
			<NavigationLink
				value={encodeComposeDestination({
					screen: 'envEditor',
					binding: { session: envSession },
					readOnly: false,
					title: ''
				})}
			>
				<Text>Edit Environment Variables</Text>
			</NavigationLink>
			<Button label="Import YAML File" onPress={model.importYAMLFile} />
			<Button label="Convert Docker Run Command" onPress={() => model.setShowDockerRun(true)} />
			<Text
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				Paste YAML in the YAML tab of the editor.
			</Text>
		</Section>
	);
}

/** The "Import Command" sheet. */
function DockerRunSheet({ model }: { model: CreateProjectModel }) {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	return (
		<NavigationStack>
			<Toolbar>
				<Form modifiers={[navigationTitle('Import Command'), ...plainTextInput]}>
					<Section title="Docker Run Command">
						<BoundField
							placeholder=""
							value={model.dockerRun}
							onChange={model.setDockerRun}
							axis="vertical"
							modifiers={[
								frame({ minHeight: 180, alignment: 'topLeading' }),
								font({ textStyle: 'body', design: 'monospaced' })
							]}
						/>
					</Section>
					<Text>Conversion replaces the Compose and environment drafts after you confirm.</Text>
					<Button
						label="Convert and Replace Draft"
						onPress={model.convertDockerRun}
						modifiers={[disabled(model.dockerRun === '' || model.isLoading)]}
					/>
				</Form>
				<Toolbar.Content>
					<ToolbarItem placement="cancellationAction">
						<Button
							label="Cancel"
							onPress={() => model.setShowDockerRun(false)}
							modifiers={toolbarSymbol}
						/>
					</ToolbarItem>
				</Toolbar.Content>
			</Toolbar>
		</NavigationStack>
	);
}

export function CreateProjectScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useCreateProject();
	const [path, setPath] = useState<string[]>([]);
	const [composeSession] = useState(() => makeSessionID('create-compose'));
	const [envSession] = useState(() => makeSessionID('create-env'));
	useComposeSessionHost(composeSession, model.composeContent, model.setComposeContent);
	useComposeSessionHost(envSession, model.envContent, model.setEnvContent);

	return (
		<View style={{ flex: 1 }}>
			{/* `.interactiveDismissDisabled(previewEnabled && hasDraftChanges)`. */}
			<Stack.Screen options={{ gestureEnabled: !model.dismissDisabled }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack path={path} onPathChange={setPath}>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle('Create Project'),
								navigationBarTitleDisplayMode('inline'),
								disabled(model.isLoading)
							]}
						>
							<Section title="Project Name">
								<FormTextField
									title="Name"
									placeholder="my-app"
									text={model.name}
									onChangeText={model.setName}
									autocapitalization="never"
									autocorrectionDisabled
								/>
							</Section>

							{model.isPrefilled ? (
								model.templateLabel !== undefined ? (
									<Section title="Template">
										<HStack>
											<Image
												systemName="doc.text.fill"
												modifiers={[foregroundStyle(systemColors.indigo)]}
											/>
											<Text>{model.templateLabel}</Text>
											<Spacer />
											<Text
												modifiers={[
													font({ textStyle: 'caption' }),
													foregroundStyle({ type: 'hierarchical', style: 'secondary' })
												]}
											>
												Loaded
											</Text>
										</HStack>
									</Section>
								) : null
							) : model.canBrowseTemplates ? (
								<Section title="Template">
									{model.isLoadingTemplates ? (
										<ArcaneLoadingViewSwiftUI label="Loading templates..." />
									) : model.templates.length === 0 ? (
										<Text
											modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
										>
											No templates available
										</Text>
									) : (
										<>
											<Picker
												label="Use Template"
												selection={model.selectedTemplateID}
												onSelectionChange={(value: string) => model.selectTemplate(value)}
											>
												<Text modifiers={[tag('')]}>Blank</Text>
												{model.templates.map((template) => (
													<Text key={template.id} modifiers={[tag(template.id)]}>
														{template.name}
													</Text>
												))}
											</Picker>
											{model.selectedTemplate ? (
												<Text
													modifiers={[
														font({ textStyle: 'caption' }),
														foregroundStyle({ type: 'hierarchical', style: 'secondary' })
													]}
												>
													{model.selectedTemplate.description}
												</Text>
											) : null}
										</>
									)}
								</Section>
							) : null}

							{model.previewEnabled ? (
								<ComposePreviewSection
									model={model}
									composeSession={composeSession}
									envSession={envSession}
								/>
							) : (
								<>
									<Section
										header={
											<HStack>
												<Text>Compose File</Text>
												<Spacer />
												<Button
													onPress={model.openVariables}
													modifiers={[disabled(model.composeContent === '')]}
												>
													<Label
														title="Variables"
														systemImage="curlybraces"
														modifiers={[font({ textStyle: 'caption' })]}
													/>
												</Button>
											</HStack>
										}
									>
										<EditorRow
											text={model.composeContent}
											onChangeText={model.setComposeContent}
											language="yaml"
											height={220}
										/>
									</Section>

									<Section title=".env">
										<EditorRow
											text={model.envContent}
											onChangeText={model.setEnvContent}
											language="env"
											height={140}
										/>
									</Section>
								</>
							)}

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
								<Button label="Cancel" onPress={model.cancel} modifiers={toolbarSymbol} />
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								{model.isLoading ? (
									<ProgressView modifiers={[scaleEffect(0.8)]} />
								) : (
									<Button
										label={model.previewEnabled ? 'Review' : 'Create'}
										onPress={model.create}
										modifiers={[disabled(!model.canCreate), ...toolbarSymbol]}
									/>
								)}
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
					{path.map((value) => (
						<NavigationDestination key={value} value={value}>
							<ComposeDestinationView value={value} />
						</NavigationDestination>
					))}
				</NavigationStack>
				<Sheet isPresented={model.showDockerRun} onDismiss={() => model.setShowDockerRun(false)}>
					<DockerRunSheet model={model} />
				</Sheet>
			</Host>
			<DeleteConfirmationHost hostID={createProjectConfirmationHost} />
		</View>
	);
}
