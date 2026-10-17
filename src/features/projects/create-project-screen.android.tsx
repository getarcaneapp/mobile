import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { CodeEditor } from '@/ui/components/code-editor';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';

import { M3Section } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';

import { FullScreenDialog, NavRow, TextAction } from '@/features/compose/compose-android-kit';
import { encodeComposeDestination } from '@/features/compose/compose-destinations';
import { makeSessionID, useComposeSessionHost } from '@/features/compose/compose-session';
import { DeleteConfirmationHost } from '@/ui/components/delete-confirmation';
import { monoFamily } from '@/ui/components/type-scale';

import { useProjectNavigation } from './project-routes';
import {
	createProjectConfirmationHost,
	useCreateProject,
	type CreateProjectModel
} from './use-create-project';

function ComposePreviewSection({ model }: { model: CreateProjectModel }) {
	const nav = useProjectNavigation();
	const [composeSession] = useState(() => makeSessionID('create-compose'));
	const [envSession] = useState(() => makeSessionID('create-env'));
	useComposeSessionHost(composeSession, model.composeContent, model.setComposeContent);
	useComposeSessionHost(envSession, model.envContent, model.setEnvContent);
	return (
		<M3Section title="Compose · Preview">
			<NavRow
				title="Edit Compose"
				onPress={() =>
					nav.openComposeEditor(
						encodeComposeDestination({
							screen: 'editor',
							binding: { session: composeSession },
							readOnly: false,
							title: 'Edit Compose'
						})
					)
				}
			/>
			<NavRow
				title="Edit Environment Variables"
				onPress={() =>
					nav.openComposeEditor(
						encodeComposeDestination({
							screen: 'envEditor',
							binding: { session: envSession },
							readOnly: false,
							title: 'Edit Environment Variables'
						})
					)
				}
			/>
			<TextAction title="Import YAML File" onPress={model.importYAMLFile} />
			<TextAction title="Convert Docker Run Command" onPress={() => model.setShowDockerRun(true)} />
			<Text
				style={[
					m3Type.bodySmall,
					{ color: colors.secondaryLabel, paddingHorizontal: 16, paddingBottom: 12 }
				]}
			>
				Paste YAML in the YAML tab of the editor.
			</Text>
		</M3Section>
	);
}

function DockerRunDialog({ model }: { model: CreateProjectModel }) {
	return (
		<FullScreenDialog
			visible={model.showDockerRun}
			title="Import Command"
			onClose={() => model.setShowDockerRun(false)}
		>
			<M3Section title="Docker Run Command">
				<TextInput
					value={model.dockerRun}
					onChangeText={model.setDockerRun}
					multiline
					autoCapitalize="none"
					autoCorrect={false}
					accessibilityLabel="Docker Run Command"
					style={[
						m3Type.bodyLarge,
						{
							color: colors.label,
							minHeight: 180,
							padding: 16,
							textAlignVertical: 'top',
							fontFamily: monoFamily
						}
					]}
				/>
			</M3Section>
			<M3Section>
				<Text
					style={[
						m3Type.bodyMedium,
						{ color: colors.label, paddingHorizontal: 16, paddingVertical: 14 }
					]}
				>
					Conversion replaces the Compose and environment drafts after you confirm.
				</Text>
				<TextAction
					title="Convert and Replace Draft"
					onPress={model.convertDockerRun}
					disabled={model.dockerRun === '' || model.isLoading}
				/>
			</M3Section>
		</FullScreenDialog>
	);
}

export function CreateProjectScreen() {
	const model = useCreateProject();
	return (
		<>
			<Stack.Screen options={{ title: 'Create Project', gestureEnabled: !model.dismissDisabled }} />
			<AndroidToolbar
				placement="left"
				items={[
					{ kind: 'button', id: 'cancel', icon: 'xmark', label: 'Cancel', onPress: model.cancel }
				]}
			/>
			<AndroidToolbar
				items={[
					model.isLoading
						? { kind: 'spinner', id: 'create', label: model.previewEnabled ? 'Review' : 'Create' }
						: {
								kind: 'button',
								id: 'create',
								icon: 'checkmark',
								label: model.previewEnabled ? 'Review' : 'Create',
								disabled: !model.canCreate,
								onPress: model.create
							}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
				pointerEvents={model.isLoading ? 'none' : 'auto'}
			>
				<M3Section title="Project Name">
					<FormTextField
						title="Name"
						placeholder="my-app"
						text={model.name}
						onChangeText={model.setName}
						autocapitalization="never"
						autocorrectionDisabled
					/>
				</M3Section>

				{model.isPrefilled ? (
					model.templateLabel !== undefined ? (
						<M3Section title="Template">
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
								<Icon name="doc.text.fill" size={20} color={systemColors.indigo} />
								<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>
									{model.templateLabel}
								</Text>
								<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>Loaded</Text>
							</View>
						</M3Section>
					) : null
				) : model.canBrowseTemplates ? (
					<M3Section title="Template">
						{model.isLoadingTemplates ? (
							<View style={{ padding: 16, alignItems: 'center' }}>
								<ArcaneLoadingView label="Loading templates..." />
							</View>
						) : model.templates.length === 0 ? (
							<Text style={[m3Type.bodyLarge, { color: colors.secondaryLabel, padding: 16 }]}>
								No templates available
							</Text>
						) : (
							<>
								<FormPicker
									title="Use Template"
									selection={model.selectedTemplateID}
									onSelectionChange={model.selectTemplate}
									options={[
										{ label: 'Blank', value: '' },
										...model.templates.map((t) => ({ label: t.name, value: t.id }))
									]}
								/>
								{model.selectedTemplate ? (
									<Text
										style={[
											m3Type.bodySmall,
											{ color: colors.secondaryLabel, paddingHorizontal: 16, paddingBottom: 12 }
										]}
									>
										{model.selectedTemplate.description}
									</Text>
								) : null}
							</>
						)}
					</M3Section>
				) : null}

				{model.previewEnabled ? (
					<ComposePreviewSection model={model} />
				) : (
					<>
						<View>
							<View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 16 }}>
								<View style={{ flex: 1 }}>
									<MaterialSectionHeader title="Compose File" />
								</View>
								<Pressable
									onPress={model.openVariables}
									disabled={model.composeContent === ''}
									accessibilityRole="button"
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: 4,
										paddingTop: 14,
										opacity: model.composeContent === '' ? 0.4 : 1
									}}
								>
									<Icon name="curlybraces" size={14} color={m3.primary} />
									<Text style={[m3Type.labelMedium, { color: m3.primary }]}>Variables</Text>
								</Pressable>
							</View>
							<MaterialListGroup>
								<CodeEditor
									text={model.composeContent}
									onChangeText={model.setComposeContent}
									language="yaml"
									height={220}
								/>
							</MaterialListGroup>
						</View>

						<View>
							<MaterialSectionHeader title=".env" />
							<MaterialListGroup>
								<CodeEditor
									text={model.envContent}
									onChangeText={model.setEnvContent}
									language="env"
									height={140}
								/>
							</MaterialListGroup>
						</View>
					</>
				)}

				{model.errorMessage !== undefined ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}>
						<Icon name="exclamationmark.triangle" size={18} color={systemColors.red} />
						<Text style={[m3Type.bodyMedium, { color: systemColors.red, flex: 1 }]}>
							{model.errorMessage}
						</Text>
					</View>
				) : null}
			</ScrollView>
			<DockerRunDialog model={model} />
			<DeleteConfirmationHost hostID={createProjectConfirmationHost} />
		</>
	);
}
