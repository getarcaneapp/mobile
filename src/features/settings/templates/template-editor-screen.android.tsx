/**
 * Android rendering of `TemplateEditorView` (TemplateEditorView.swift). The
 * file editors open in place (the sheet's own navigation stack on iOS); back
 * returns to the form, and leaving with unsaved changes asks first.
 */
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { DeleteConfirmationHost } from '@/ui/components/delete-confirmation';
import { FormTextField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { ToastHost } from '@/ui/toast';

import { M3Section, TextButtonRow } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';

import { CodeEditor } from '@/ui/components/code-editor';
import { templateEditorConfirmationHost, useTemplateEditor } from './use-template-editor';

type OpenFile = 'compose' | 'env';

function Notice({ text, color }: { text: string; color: string }) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
			<Icon name="exclamationmark.triangle" size={20} color={color} />
			<Text style={[m3Type.bodyMedium, { color, flex: 1 }]}>{text}</Text>
		</View>
	);
}

function FileLink({ title, onPress }: { title: string; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16 }}
		>
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
			<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />
		</Pressable>
	);
}

export function TemplateEditorScreen() {
	const model = useTemplateEditor();
	const [openFile, setOpenFile] = useState<OpenFile>();

	// Hardware back: close an open file first; otherwise behave like Cancel while dismissal is blocked.
	const latest = useRef({ openFile, model });
	latest.current = { openFile, model };
	useEffect(() => {
		const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
			const { openFile: file, model: current } = latest.current;
			if (file) {
				setOpenFile(undefined);
				return true;
			}
			if (!current.dismissDisabled) return false;
			if (!current.isSaving) current.cancel();
			return true;
		});
		return () => subscription.remove();
	}, []);

	if (openFile) {
		const isEnvironment = openFile === 'env';
		return (
			<View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
				<Stack.Screen options={{ title: isEnvironment ? '.env' : 'compose.yml' }} />
				<AndroidToolbar
					placement="left"
					items={[
						{
							kind: 'button',
							id: 'back',
							icon: 'chevron.left',
							label: 'Back',
							onPress: () => setOpenFile(undefined)
						}
					]}
				/>
				<CodeEditor
					text={isEnvironment ? model.fields.environment : model.fields.compose}
					onChangeText={(text) =>
						model.update(isEnvironment ? { environment: text } : { compose: text })
					}
					language={isEnvironment ? 'env' : 'yaml'}
					readOnly={model.readOnly}
					accessibilityLabel={isEnvironment ? '.env' : 'compose.yml'}
				/>
				<ToastHost reservesTabBarSpace={false} />
			</View>
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen options={{ title: model.title, gestureEnabled: !model.dismissDisabled }} />
			<AndroidToolbar
				placement="left"
				items={[
					{
						kind: 'button',
						id: 'cancel',
						icon: 'xmark',
						label: 'Cancel',
						disabled: model.isSaving,
						onPress: model.cancel
					}
				]}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'save',
						icon: 'checkmark',
						label: 'Save',
						color: m3.primary,
						disabled: model.saveDisabled,
						onPress: model.save
					}
				]}
			/>
			<ScrollView
				contentContainerStyle={{ paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
				pointerEvents={model.isSaving ? 'none' : 'auto'}
			>
				{model.isLoaded ? (
					<>
						{!model.isDefaults ? (
							<M3Section title="Template">
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
							</M3Section>
						) : null}
						<M3Section
							title="Files"
							footer={
								model.isDefaults
									? 'Defaults provide the starting Compose and environment files for new projects.'
									: undefined
							}
						>
							<FileLink title="Compose file" onPress={() => setOpenFile('compose')} />
							<FileLink title="Environment variables" onPress={() => setOpenFile('env')} />
						</M3Section>
					</>
				) : model.errorMessage === undefined ? (
					<View style={{ padding: 24, alignItems: 'center' }}>
						<ArcaneLoadingView label="Loading template…" />
					</View>
				) : null}
				{model.sessionChanged ? (
					<M3Section>
						<Notice
							text="The connection changed. Close this editor and reopen it on the intended server before saving."
							color={systemColors.orange}
						/>
					</M3Section>
				) : null}
				{model.errorMessage !== undefined ? (
					<M3Section>
						<Notice text={model.errorMessage} color={systemColors.red} />
						{!model.isLoaded ? <TextButtonRow title="Try Again" onPress={model.retry} /> : null}
					</M3Section>
				) : null}
			</ScrollView>
			<ToastHost reservesTabBarSpace={false} />
			<DeleteConfirmationHost hostID={templateEditorConfirmationHost} />
		</View>
	);
}
