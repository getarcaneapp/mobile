/**
 * Ports of `VolumeWorkspaceFileView` and its "Server version" review sheet
 * (VolumeWorkspaceFileView.swift).
 *
 * `CodeEditorView` isn't ported yet, so the editor is a monospaced multi-line
 * SwiftUI `TextField` (plain text, like the reference's `.plaintext` language).
 */
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	NavigationStack,
	ScrollView,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	disabled,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	textInputAutocapitalization,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { ToastHost } from '@/ui/toast';

import { BoundTextField } from '@/features/containers/swiftui-text-field';

import { useVolumeWorkspaceFile, type WorkspaceReviewPayload } from './use-volume-workspace-file';
import { routePayloads } from './volume-routes';

export function VolumeWorkspaceFileScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const {
		name = '',
		envID = '0',
		relativePath = ''
	} = useLocalSearchParams<{ name?: string; envID?: string; relativePath?: string }>();
	const model = useVolumeWorkspaceFile(envID, name, relativePath);

	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ gestureEnabled: !model.hasChanges }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<VStack
							alignment="leading"
							modifiers={[
								frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
								navigationTitle(model.file.name),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							{model.errorMessage !== undefined ? (
								<Text modifiers={[foregroundStyle(systemColors.red), padding({ horizontal: 16 })]}>
									{model.errorMessage}
								</Text>
							) : null}
							{model.readOnlyReason !== undefined ? (
								<Text
									modifiers={[font({ textStyle: 'caption' }), padding({ horizontal: 16 })]}
								>{`Read only: ${model.readOnlyReason}`}</Text>
							) : null}
							{model.loading ? (
								<VStack modifiers={[frame({ maxWidth: Infinity })]}>
									<ArcaneLoadingViewSwiftUI />
								</VStack>
							) : null}
							{model.hasText ? (
								<BoundTextField
									placeholder=""
									value={model.draft.text}
									onChangeText={model.setText}
									axis="vertical"
									modifiers={[
										font({ textStyle: 'body', design: 'monospaced' }),
										textInputAutocapitalization('never'),
										autocorrectionDisabled(),
										lineLimit(100_000),
										padding({ all: 16 }),
										frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
										disabled(!model.canEdit || model.loading)
									]}
								/>
							) : !model.loading ? (
								<ContentUnavailableView
									title="Preview Unavailable"
									systemImage="doc"
									description="Download this file to open it in another app."
								/>
							) : null}
							{model.draft.conflict ? (
								<Button
									label="Review server version"
									onPress={model.reviewConflict}
									modifiers={[padding({ all: 16 })]}
								/>
							) : null}
						</VStack>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label={model.hasChanges ? 'Discard' : 'Done'}
									onPress={model.dismiss}
									modifiers={toolbarSymbol}
								/>
							</ToolbarItem>
							{/* @expo/ui renders same-placement items in reverse: Save declared first lands rightmost, as in Swift. */}
							{model.canEdit ? (
								<ToolbarItem placement="primaryAction">
									<Button
										label="Save"
										onPress={model.save}
										modifiers={[disabled(!model.canSave), ...toolbarSymbol]}
									/>
								</ToolbarItem>
							) : null}
							<ToolbarItem placement="primaryAction">
								{model.downloaded ? (
									<Button
										label="Share"
										systemImage="square.and.arrow.up"
										onPress={model.share}
										modifiers={toolbarSymbol}
									/>
								) : (
									<Button
										label="Download"
										systemImage="square.and.arrow.down"
										onPress={model.download}
										modifiers={[disabled(model.loading), ...toolbarSymbol]}
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

/** The "Server version" sheet (`.sheet(isPresented: $reviewing)`). */
export function VolumeWorkspaceReviewScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const router = useRouter();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => routePayloads.get<WorkspaceReviewPayload>(token));
	const latest = payload?.latest;
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<ScrollView modifiers={[navigationTitle('Server version')]}>
						<Text
							modifiers={[
								font({ textStyle: 'body', design: 'monospaced' }),
								textSelection(true),
								padding({ all: 16 })
							]}
						>
							{latest?.content ?? 'No text content'}
						</Text>
					</ScrollView>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Cancel" onPress={() => router.back()} modifiers={toolbarSymbol} />
						</ToolbarItem>
						<ToolbarItem placement="confirmationAction">
							<Button
								label="Keep my draft"
								onPress={() => {
									payload?.onKeep();
									routePayloads.delete(token);
									router.back();
								}}
								modifiers={[disabled(latest?.editable !== true), ...toolbarSymbol]}
							/>
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
