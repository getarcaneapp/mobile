/**
 * Port of `ProjectFilesWorkspaceView` (ProjectFilesWorkspaceView.swift),
 * presented as a sheet with its own SwiftUI NavigationStack: the compose and
 * .env editors, the file browser with folder drill-downs, and managed file
 * editors, all sharing one draft. With the native Compose editor preview the
 * compose, .env and compose-related files open in the native editors.
 */
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	ContextMenu,
	Divider,
	HStack,
	Label,
	List,
	Menu,
	NavigationDestination,
	NavigationLink,
	NavigationStack,
	ProgressView,
	RNHostView,
	Section,
	Spacer,
	SwipeActions,
	Text,
	Toolbar,
	ToolbarItem,
	VStack,
	ZStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	background,
	disabled,
	font,
	foregroundStyle,
	frame,
	listRowInsets,
	listStyle,
	multilineTextAlignment,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	refreshable,
	scaleEffect,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { CodeEditor, type CodeEditorLanguage } from '@/ui/components/code-editor';
import { DeleteConfirmationHost } from '@/ui/components/delete-confirmation';
import { DestructiveLabel } from '@/ui/components/labels';
import { glassEffectCompat } from '@/ui/components/swiftui-surfaces';

import {
	makeSessionID,
	useComposeSessionHost,
	type ComposeMenuAction
} from '@/features/compose/compose-session';
import {
	ComposeDestinationView,
	isComposeDestination
} from '@/features/compose/ios/compose-destination-view.ios';
import {
	ComposePreviewEditorView,
	EnvPreviewEditorView
} from '@/features/compose/ios/compose-preview-editor.ios';

import { ProjectFileBrowserRow } from './project-file-row';
import {
	encodeDestination,
	decodeDestination,
	isProtectedEntry,
	ProjectFileWorkspaceHelpers,
	type ManagedProjectFileEntry,
	type ProjectFilesDestination
} from './project-files-model';
import {
	destinationFolderPath,
	destinationTitle,
	projectFilesConfirmationHost,
	useProjectFilesWorkspace,
	type ProjectFilesWorkspaceModel
} from './use-project-files-workspace';

type Model = ProjectFilesWorkspaceModel;

/** `ProjectTextFileEditorView`. */
function TextFileEditor({
	text,
	onChangeText,
	language,
	readOnly,
	readOnlyMessage,
	isLoading,
	errorMessage,
	onResolveVariables,
	onRetry
}: {
	text: string;
	onChangeText: (text: string) => void;
	language: CodeEditorLanguage;
	readOnly: boolean;
	readOnlyMessage?: string;
	isLoading: boolean;
	errorMessage?: string;
	onResolveVariables?: () => void;
	onRetry?: () => void;
}) {
	return (
		<VStack spacing={0}>
			{errorMessage !== undefined ? (
				<HStack
					spacing={8}
					modifiers={[padding({ all: 10 }), background(withOpacity(systemColors.red, 0.1))]}
				>
					<Image
						systemName="exclamationmark.triangle.fill"
						modifiers={[foregroundStyle(systemColors.red)]}
					/>
					<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(systemColors.red)]}>
						{errorMessage}
					</Text>
					<Spacer />
					{onRetry ? (
						<Button
							label="Retry"
							onPress={onRetry}
							modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}
						/>
					) : null}
				</HStack>
			) : readOnly && readOnlyMessage !== undefined ? (
				<Label
					title={readOnlyMessage}
					systemImage="lock"
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						frame({ maxWidth: Infinity, alignment: 'leading' }),
						padding({ all: 10 }),
						background({ type: 'material', material: 'regular' })
					]}
				/>
			) : null}
			<ZStack
				alignment="bottomTrailing"
				modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}
			>
				<RNHostView>
					<View style={{ flex: 1 }}>
						<CodeEditor
							text={text}
							onChangeText={onChangeText}
							language={language}
							readOnly={readOnly}
						/>
					</View>
				</RNHostView>
				{isLoading ? (
					<VStack
						modifiers={[
							padding({ all: 16 }),
							background(
								{ type: 'material', material: 'regular' },
								shapes.roundedRectangle({
									cornerRadius: Radius.nested,
									roundedCornerStyle: 'continuous'
								})
							)
						]}
					>
						<ArcaneLoadingViewSwiftUI label="Loading file..." />
					</VStack>
				) : null}
				{onResolveVariables && !readOnly && text !== '' ? (
					<Button
						onPress={onResolveVariables}
						modifiers={[
							padding({ trailing: 16, bottom: 16 }),
							accessibilityLabel('Resolve Variables')
						]}
					>
						<Image
							systemName="curlybraces"
							modifiers={[
								font({ textStyle: 'title3', weight: 'semibold' }),
								foregroundStyle(systemColors.indigo),
								frame({ width: 52, height: 52 }),
								glassEffectCompat({ shape: 'circle' })
							]}
						/>
					</Button>
				) : null}
			</ZStack>
		</VStack>
	);
}

/** `projectFileActions(folderPath:)` as editor menu items (Swift passes them as `menuActions`). */
function useProjectFileMenuActions(model: Model, folderPath: string): ComposeMenuAction[] {
	const {
		previewEnabled,
		canDeploy,
		canEdit,
		hasChanges,
		isSaving,
		deploySaved,
		newFile,
		newFolder,
		reload
	} = model;
	return useMemo(() => {
		const actions: ComposeMenuAction[] = [];
		if (previewEnabled && canDeploy) {
			actions.push({
				id: 'deploy',
				title: 'Deploy Saved Project',
				systemImage: 'play',
				disabled: !canEdit || hasChanges || isSaving,
				onPress: deploySaved
			});
		}
		actions.push(
			{
				id: 'new-file',
				title: 'New File',
				systemImage: 'doc.badge.plus',
				disabled: !canEdit,
				dividerBefore: actions.length > 0,
				onPress: () => newFile(folderPath)
			},
			{
				id: 'new-folder',
				title: 'New Folder',
				systemImage: 'folder.badge.plus',
				disabled: !canEdit,
				onPress: () => newFolder(folderPath)
			},
			{
				id: 'reload',
				title: 'Reload',
				systemImage: 'arrow.clockwise',
				dividerBefore: true,
				onPress: reload
			}
		);
		return actions;
	}, [
		previewEnabled,
		canDeploy,
		canEdit,
		hasChanges,
		isSaving,
		deploySaved,
		newFile,
		newFolder,
		reload,
		folderPath
	]);
}

function ProjectFileActions({ model, folderPath }: { model: Model; folderPath: string }) {
	return (
		<>
			{model.previewEnabled && model.canDeploy ? (
				<>
					<Button
						label="Deploy Saved Project"
						systemImage="play"
						onPress={model.deploySaved}
						modifiers={[disabled(!model.canEdit || model.hasChanges || model.isSaving)]}
					/>
					<Divider />
				</>
			) : null}
			<Button
				label="New File"
				systemImage="doc.badge.plus"
				onPress={() => model.newFile(folderPath)}
				modifiers={[disabled(!model.canEdit)]}
			/>
			<Button
				label="New Folder"
				systemImage="folder.badge.plus"
				onPress={() => model.newFolder(folderPath)}
				modifiers={[disabled(!model.canEdit)]}
			/>
			<Divider />
			<Button label="Reload" systemImage="arrow.clockwise" onPress={model.reload} />
		</>
	);
}

function WorkspaceToolbar({
	model,
	destination,
	isRoot,
	combined = false,
	children
}: {
	model: Model;
	destination: ProjectFilesDestination;
	isRoot: boolean;
	/** `editorToolbar(combined:)`: the native editors carry the file actions in their own menu. */
	combined?: boolean;
	children: ReactNode;
}) {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	return (
		<Toolbar>
			{children}
			<Toolbar.Content>
				{isRoot ? (
					<ToolbarItem placement="topBarLeading">
						<Button label="Done" onPress={model.done} modifiers={toolbarSymbol} />
					</ToolbarItem>
				) : null}
				{/* @expo/ui nests one `.toolbar` per item, so same-placement items render in reverse: Save last = rightmost. */}
				<ToolbarItem placement="topBarTrailing">
					<Button
						onPress={model.save}
						modifiers={[
							accessibilityLabel('Save'),
							disabled(!model.canEdit || !model.hasChanges || model.isSaving),
							...toolbarSymbol
						]}
					>
						{model.isSaving ? (
							<ProgressView modifiers={[scaleEffect(0.8)]} />
						) : (
							<Image systemName="checkmark" />
						)}
					</Button>
				</ToolbarItem>
				{!combined ? (
					<ToolbarItem placement="topBarTrailing">
						<Menu
							label={<Image systemName={model.previewEnabled ? 'ellipsis' : 'plus'} />}
							modifiers={[
								accessibilityLabel(
									model.previewEnabled ? 'Project file actions' : 'Add file or folder'
								),
								...toolbarSymbol
							]}
						>
							<ProjectFileActions model={model} folderPath={destinationFolderPath(destination)} />
						</Menu>
					</ToolbarItem>
				) : null}
			</Toolbar.Content>
		</Toolbar>
	);
}

/** `managedFileEditor(path:)` with the preview: compose-related files and `.env*` files open natively. */
export function managedFilePreviewKind(model: Model, path: string): 'compose' | 'env' | undefined {
	if (!model.previewEnabled || model.managedFileContent(path) === undefined) return undefined;
	if (model.composeRelatedPaths.has(path)) return 'compose';
	if (ProjectFileWorkspaceHelpers.basename(path).startsWith('.env')) return 'env';
	return undefined;
}

/** `editorNotice`. */
function EditorNotice({ model }: { model: Model }) {
	const message = model.errorMessage ?? model.readOnlyReason;
	return (
		<>
			{message !== undefined ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						padding({ all: 16 })
					]}
				>
					{message}
				</Text>
			) : null}
			{!model.sessionIsCurrent ? (
				<Text modifiers={[font({ textStyle: 'caption' }), padding({ all: 16 })]}>
					Connection changed. Reopen this editor to save.
				</Text>
			) : null}
		</>
	);
}

/** A native editor over host-owned text (`ComposePreviewEditor` / `EnvPreviewEditor`). */
function PreviewEditor({
	kind,
	text,
	setText,
	readOnly,
	menuActions,
	notice
}: {
	kind: 'compose' | 'env';
	text: string;
	setText: (text: string) => void;
	readOnly: boolean;
	menuActions: ComposeMenuAction[];
	notice?: ReactNode;
}) {
	const [session] = useState(() =>
		makeSessionID(kind === 'compose' ? 'files-compose' : 'files-env')
	);
	useComposeSessionHost(session, text, setText, menuActions);
	return (
		<VStack spacing={0}>
			{notice}
			{kind === 'compose' ? (
				<ComposePreviewEditorView bindingRef={{ session }} readOnly={readOnly} />
			) : (
				<EnvPreviewEditorView bindingRef={{ session }} readOnly={readOnly} />
			)}
		</VStack>
	);
}

function ManagedFileEditor({ model, path }: { model: Model; path: string }) {
	const entry = model.entryFor(path);
	const menuActions = useProjectFileMenuActions(
		model,
		ProjectFileWorkspaceHelpers.parentPath(path)
	);
	const setManagedFileContent = model.setManagedFileContent;
	const setText = useMemo(
		() => (text: string) => setManagedFileContent(path, text),
		[setManagedFileContent, path]
	);
	useEffect(() => {
		void model.loadManagedFileContent(path);
		// `.task(id: path)`.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [path]);
	if (entry?.isDirectory)
		return <ContentUnavailableView title="Folder" systemImage="folder" description={path} />;
	const previewKind = managedFilePreviewKind(model, path);
	if (previewKind) {
		return (
			<PreviewEditor
				kind={previewKind}
				text={model.managedFileContent(path) ?? ''}
				setText={setText}
				readOnly={model.isEntryReadOnly(path)}
				menuActions={menuActions}
			/>
		);
	}
	return (
		<TextFileEditor
			text={model.managedFileContent(path) ?? ''}
			onChangeText={(text) => model.setManagedFileContent(path, text)}
			language={ProjectFileWorkspaceHelpers.language(path)}
			readOnly={model.isEntryReadOnly(path)}
			readOnlyMessage={model.readOnlyReason}
			isLoading={model.managedFileIsLoading(path)}
			errorMessage={model.managedFileLoadError(path)}
			onRetry={() => void model.loadManagedFileContent(path, true)}
		/>
	);
}

function EntryContextMenu({ model, entry }: { model: Model; entry: ManagedProjectFileEntry }) {
	if (!model.canEdit || isProtectedEntry(entry))
		return <Label title="Read Only" systemImage="lock" />;
	return (
		<>
			{entry.isDirectory ? (
				<>
					<Button
						label="New File"
						systemImage="doc.badge.plus"
						onPress={() => model.newFile(entry.relativePath)}
					/>
					<Button
						label="New Folder"
						systemImage="folder.badge.plus"
						onPress={() => model.newFolder(entry.relativePath)}
					/>
				</>
			) : null}
			<Button label="Rename" systemImage="pencil" onPress={() => model.rename(entry)} />
			<Button label="Move" systemImage="folder" onPress={() => model.move(entry)} />
			<Button
				role="destructive"
				onPress={() => model.requestDelete(entry)}
				modifiers={[tint(systemColors.red)]}
			>
				<DestructiveLabel text="Delete" />
			</Button>
		</>
	);
}

function FilesBrowser({ model, folderPath }: { model: Model; folderPath: string }) {
	const children = model.childEntries(folderPath);
	return (
		<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
			{model.readOnlyReason !== undefined ? (
				<Section>
					<Label
						title={model.readOnlyReason}
						systemImage="lock"
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					/>
				</Section>
			) : null}

			<Section>
				{folderPath === '' ? (
					<>
						<NavigationLink value={encodeDestination({ kind: 'compose' })}>
							<ProjectFileBrowserRow
								name={model.composeFileName}
								systemImage="doc.text"
								isDirectory={false}
								hasChanges={model.composeChanged}
								showsDisclosure={false}
							/>
						</NavigationLink>
						<NavigationLink value={encodeDestination({ kind: 'env' })}>
							<ProjectFileBrowserRow
								name=".env"
								systemImage="key.horizontal"
								isDirectory={false}
								hasChanges={model.envChanged}
								showsDisclosure={false}
							/>
						</NavigationLink>
					</>
				) : null}

				{children.length === 0 && folderPath !== '' ? (
					<VStack
						spacing={12}
						modifiers={[
							frame({ maxWidth: Infinity }),
							padding({ vertical: 20 }),
							listRowInsets({ top: 16, leading: 16, bottom: 16, trailing: 16 })
						]}
					>
						<Image
							systemName="folder"
							modifiers={[
								font({ textStyle: 'largeTitle' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						/>
						<Text modifiers={[font({ textStyle: 'headline' })]}>Empty Folder</Text>
						<Text
							modifiers={[
								font({ textStyle: 'subheadline' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
								multilineTextAlignment('center')
							]}
						>
							{model.emptyStateMessage}
						</Text>
					</VStack>
				) : (
					children.map((entry) => {
						const destination: ProjectFilesDestination = entry.isDirectory
							? { kind: 'folder', path: entry.relativePath }
							: { kind: 'managedFile', path: entry.relativePath };
						return (
							<SwipeActions key={entry.id}>
								<ContextMenu>
									<ContextMenu.Trigger>
										<NavigationLink value={encodeDestination(destination)}>
											<ProjectFileBrowserRow
												name={entry.name}
												detail={model.browserRowDetail(entry)}
												systemImage={entry.isDirectory ? 'folder.fill' : 'doc.text'}
												isDirectory={entry.isDirectory}
												isProtected={isProtectedEntry(entry)}
												hasChanges={
													entry.pending || model.fileHasUnsavedContent(entry.relativePath)
												}
												isLoading={model.managedFileIsLoading(entry.relativePath)}
												showsDisclosure={false}
											/>
										</NavigationLink>
									</ContextMenu.Trigger>
									<ContextMenu.Items>
										<EntryContextMenu model={model} entry={entry} />
									</ContextMenu.Items>
								</ContextMenu>
								{model.canEdit && !isProtectedEntry(entry) ? (
									<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
										<Button
											role="destructive"
											label="Delete"
											systemImage="trash"
											onPress={() => model.requestDelete(entry)}
											modifiers={[tint(systemColors.red)]}
										/>
									</SwipeActions.Actions>
								) : null}
							</SwipeActions>
						);
					})
				)}
			</Section>

			{model.hasChanges ? (
				<Section>
					<Label
						title="Unsaved changes"
						systemImage="circle.fill"
						modifiers={[font({ textStyle: 'caption' }), foregroundStyle(systemColors.orange)]}
					/>
				</Section>
			) : null}

			{model.errorMessage !== undefined ? (
				<Section>
					<Label
						title={model.errorMessage}
						systemImage="exclamationmark.triangle"
						modifiers={[font({ textStyle: 'caption' }), foregroundStyle(systemColors.red)]}
					/>
				</Section>
			) : null}
		</List>
	);
}

/** `workspaceContent(for:)`. */
function WorkspaceContent({
	model,
	destination,
	isRoot
}: {
	model: Model;
	destination: ProjectFilesDestination;
	isRoot: boolean;
}) {
	const title = destinationTitle(model, destination);
	const rootMenuActions = useProjectFileMenuActions(model, '');
	const inline =
		destination.kind === 'compose' ||
		destination.kind === 'env' ||
		destination.kind === 'managedFile';
	let content;
	switch (destination.kind) {
		case 'compose':
			content = model.previewEnabled ? (
				<PreviewEditor
					kind="compose"
					text={model.composeContent}
					setText={model.setComposeContent}
					readOnly={!model.canEdit}
					menuActions={rootMenuActions}
					notice={<EditorNotice model={model} />}
				/>
			) : (
				<TextFileEditor
					text={model.composeContent}
					onChangeText={model.setComposeContent}
					language="yaml"
					readOnly={!model.canEdit}
					readOnlyMessage={model.readOnlyReason}
					isLoading={false}
					errorMessage={model.errorMessage}
					onResolveVariables={model.resolveVariables}
				/>
			);
			break;
		case 'env':
			content = model.previewEnabled ? (
				<PreviewEditor
					kind="env"
					text={model.envContent}
					setText={model.setEnvContent}
					readOnly={!model.canEdit}
					menuActions={rootMenuActions}
					notice={<EditorNotice model={model} />}
				/>
			) : (
				<TextFileEditor
					text={model.envContent}
					onChangeText={model.setEnvContent}
					language="env"
					readOnly={!model.canEdit}
					readOnlyMessage={model.readOnlyReason}
					isLoading={false}
					errorMessage={model.errorMessage}
				/>
			);
			break;
		case 'files':
			content = <FilesBrowser model={model} folderPath="" />;
			break;
		case 'folder':
			content = <FilesBrowser model={model} folderPath={destination.path} />;
			break;
		case 'managedFile':
			content = <ManagedFileEditor model={model} path={destination.path} />;
			break;
	}
	const combined =
		model.previewEnabled &&
		(destination.kind === 'compose' ||
			destination.kind === 'env' ||
			(destination.kind === 'managedFile' &&
				managedFilePreviewKind(model, destination.path) !== undefined));
	return (
		<WorkspaceToolbar model={model} destination={destination} isRoot={isRoot} combined={combined}>
			<VStack
				spacing={0}
				modifiers={[
					navigationTitle(title),
					navigationBarTitleDisplayMode(inline ? 'inline' : 'large')
				]}
			>
				{content}
			</VStack>
		</WorkspaceToolbar>
	);
}

export function ProjectFilesScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useProjectFilesWorkspace();
	const [path, setPath] = useState<string[]>([]);

	const root =
		model.isLoading && !model.hasLoaded ? (
			<Toolbar>
				<VStack
					modifiers={[
						frame({ maxWidth: Infinity, maxHeight: Infinity }),
						navigationTitle('Project Files')
					]}
				>
					<ArcaneLoadingViewSwiftUI label="Loading files..." />
				</VStack>
				<Toolbar.Content>
					<ToolbarItem placement="topBarLeading">
						<Button label="Done" onPress={model.done} modifiers={toolbarSymbol} />
					</ToolbarItem>
				</Toolbar.Content>
			</Toolbar>
		) : (
			<WorkspaceContent model={model} destination={model.selected} isRoot />
		);

	return (
		<View style={{ flex: 1 }}>
			{/* `.interactiveDismissDisabled(hasChanges)`. */}
			<Stack.Screen options={{ gestureEnabled: !model.hasChanges }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack path={path} onPathChange={setPath} modifiers={[disabled(model.isSaving)]}>
					{root}
					{path.map((value) => (
						<NavigationDestination key={value} value={value}>
							{isComposeDestination(value) ? (
								<ComposeDestinationView value={value} />
							) : (
								<WorkspaceContent
									model={model}
									destination={decodeDestination(value)}
									isRoot={false}
								/>
							)}
						</NavigationDestination>
					))}
				</NavigationStack>
			</Host>
			<DeleteConfirmationHost hostID={projectFilesConfirmationHost} />
		</View>
	);
}
