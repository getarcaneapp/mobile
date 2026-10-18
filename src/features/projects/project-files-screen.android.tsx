import { Stack, useFocusEffect } from 'expo-router';
import {
	useCallback,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import {
	ActivityIndicator,
	BackHandler,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	View
} from 'react-native';

import { colors, systemColors, withOpacity } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { CodeEditor, type CodeEditorLanguage } from '@/ui/components/code-editor';
import { DeleteConfirmationHost } from '@/ui/components/delete-confirmation';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { CenteredMessage, M3Section } from '@/features/containers/android-material';
import {
	AndroidToolbar,
	type AndroidMenuItem,
	type AndroidToolbarItem
} from '@/features/containers/android-toolbar';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';

import {
	encodeComposeDestination,
	type ComposeDestination
} from '@/features/compose/compose-destinations';
import {
	ComposeDestinationScreen,
	ComposeNavigationContext,
	type ComposeNavigation
} from '@/features/compose/compose-screens-android';
import { useComposeSessionHost, type ComposeMenuAction } from '@/features/compose/compose-session';

import { ProjectFileBrowserRow } from './project-file-row';
import { useProjectNavigation } from './project-routes';
import {
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
		<View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
			{errorMessage !== undefined ? (
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 8,
						padding: 10,
						backgroundColor: withOpacity(systemColors.red, 0.1)
					}}
				>
					<Icon name="exclamationmark.triangle.fill" size={16} color={systemColors.red} />
					<Text style={[m3Type.bodySmall, { color: systemColors.red, flex: 1 }]}>
						{errorMessage}
					</Text>
					{onRetry ? (
						<Pressable onPress={onRetry} accessibilityRole="button">
							<Text style={[m3Type.labelMedium, { color: m3.primary }]}>Retry</Text>
						</Pressable>
					) : null}
				</View>
			) : readOnly && readOnlyMessage !== undefined ? (
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 8,
						padding: 10,
						backgroundColor: colors.secondarySystemBackground
					}}
				>
					<Icon name="lock" size={14} color={colors.secondaryLabel} />
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel, flex: 1 }]}>
						{readOnlyMessage}
					</Text>
				</View>
			) : null}
			<View style={{ flex: 1 }}>
				<CodeEditor
					text={text}
					onChangeText={onChangeText}
					language={language}
					readOnly={readOnly}
				/>
				{isLoading ? (
					<View
						style={{
							position: 'absolute',
							right: 16,
							bottom: 16,
							padding: 16,
							borderRadius: 12,
							backgroundColor: colors.secondarySystemBackground
						}}
					>
						<ArcaneLoadingView label="Loading file..." />
					</View>
				) : null}
				{onResolveVariables && !readOnly && text !== '' ? (
					<Pressable
						onPress={onResolveVariables}
						accessibilityRole="button"
						accessibilityLabel="Resolve Variables"
						style={{
							position: 'absolute',
							right: 16,
							bottom: 16,
							width: 56,
							height: 56,
							borderRadius: 16,
							alignItems: 'center',
							justifyContent: 'center',
							backgroundColor: m3.primaryContainer,
							elevation: 3
						}}
					>
						<Icon name="curlybraces" size={24} color={systemColors.indigo} />
					</Pressable>
				) : null}
			</View>
		</View>
	);
}

function projectFileActions(model: Model, folderPath: string): ComposeMenuAction[] {
	const actions: ComposeMenuAction[] = [];
	if (model.previewEnabled && model.canDeploy) {
		actions.push({
			id: 'deploy-saved',
			title: 'Deploy Saved Project',
			systemImage: 'play',
			disabled: !model.canEdit || model.hasChanges || model.isSaving,
			onPress: model.deploySaved
		});
	}
	actions.push(
		{
			id: 'new-file',
			title: 'New File',
			systemImage: 'doc.badge.plus',
			disabled: !model.canEdit,
			dividerBefore: actions.length > 0,
			onPress: () => model.newFile(folderPath)
		},
		{
			id: 'new-folder',
			title: 'New Folder',
			systemImage: 'folder.badge.plus',
			disabled: !model.canEdit,
			onPress: () => model.newFolder(folderPath)
		},
		{
			id: 'reload',
			title: 'Reload',
			systemImage: 'arrow.clockwise',
			dividerBefore: true,
			onPress: model.reload
		}
	);
	return actions;
}

function EditorNotice({ model }: { model: Model }) {
	const message = model.errorMessage ?? model.readOnlyReason;
	return (
		<>
			{message !== undefined ? (
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel, padding: 16 }]}>
					{message}
				</Text>
			) : null}
			{!model.sessionIsCurrent ? (
				<Text style={[m3Type.bodySmall, { color: colors.label, padding: 16 }]}>
					Connection changed. Reopen this editor to save.
				</Text>
			) : null}
		</>
	);
}

function dispatchingMenuActions(
	actions: ComposeMenuAction[],
	dispatch: (id: string) => void
): ComposeMenuAction[] {
	return actions.map((action) => ({ ...action, onPress: () => dispatch(action.id) }));
}

function NativeEditor({
	model,
	session,
	screen,
	title,
	text,
	setText,
	readOnly,
	folderPath,
	navigation
}: {
	model: Model;
	session: string;
	screen: 'editor' | 'envEditor';
	title: string;
	text: string;
	setText: (text: string) => void;
	readOnly: boolean;
	folderPath: string;
	navigation: ComposeNavigation;
}) {
	const actions = projectFileActions(model, folderPath);
	const latest = useRef(actions);
	useLayoutEffect(() => {
		latest.current = actions;
	});
	const [dispatch] = useState(
		() => (id: string) => latest.current.find((candidate) => candidate.id === id)?.onPress()
	);
	const signature = JSON.stringify(actions.map((action) => [action.id, action.disabled ?? false]));
	const [menu, setMenu] = useState(() => ({
		signature,
		actions: dispatchingMenuActions(actions, dispatch)
	}));
	let menuActions = menu.actions;
	if (menu.signature !== signature) {
		menuActions = dispatchingMenuActions(actions, dispatch);
		setMenu({ signature, actions: menuActions });
	}
	useComposeSessionHost(session, text, setText, menuActions);
	const destination: ComposeDestination = { screen, binding: { session }, readOnly, title };
	return (
		<View style={{ flex: 1 }}>
			<EditorNotice model={model} />
			<ComposeNavigationContext.Provider value={navigation}>
				<ComposeDestinationScreen destination={destination} />
			</ComposeNavigationContext.Provider>
		</View>
	);
}

function nativeManagedScreen(model: Model, path: string): 'editor' | 'envEditor' | undefined {
	if (!model.previewEnabled || model.managedFileContent(path) === undefined) return undefined;
	if (model.composeRelatedPaths.has(path)) return 'editor';
	if (ProjectFileWorkspaceHelpers.basename(path).startsWith('.env')) return 'envEditor';
	return undefined;
}

function ManagedFileEditor({
	model,
	path,
	navigation
}: {
	model: Model;
	path: string;
	navigation?: ComposeNavigation;
}) {
	const entry = model.entryFor(path);
	const loadContent = useEffectEvent((target: string) => {
		void model.loadManagedFileContent(target);
	});
	useEffect(() => {
		loadContent(path);
	}, [path]);
	if (entry?.isDirectory) return <CenteredMessage icon="folder" title="Folder" message={path} />;
	const content = model.managedFileContent(path);
	const nativeScreen = nativeManagedScreen(model, path);
	if (nativeScreen && content !== undefined && navigation) {
		return (
			<NativeEditor
				model={model}
				session={`project-file:${model.projectID}:${path}`}
				screen={nativeScreen}
				title={ProjectFileWorkspaceHelpers.basename(path)}
				text={content}
				setText={(text) => model.setManagedFileContent(path, text)}
				readOnly={model.isEntryReadOnly(path)}
				folderPath={ProjectFileWorkspaceHelpers.parentPath(path)}
				navigation={navigation}
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

function entryMenu(model: Model, entry: ManagedProjectFileEntry): RowMenuItem[] {
	if (!model.canEdit || isProtectedEntry(entry))
		return [{ id: 'readonly', title: 'Read Only', disabled: true, onPress: () => {} }];
	const items: RowMenuItem[] = [];
	if (entry.isDirectory) {
		items.push(
			{ id: 'new-file', title: 'New File', onPress: () => model.newFile(entry.relativePath) },
			{ id: 'new-folder', title: 'New Folder', onPress: () => model.newFolder(entry.relativePath) }
		);
	}
	items.push(
		{ id: 'rename', title: 'Rename', onPress: () => model.rename(entry) },
		{ id: 'move', title: 'Move', onPress: () => model.move(entry) },
		{ id: 'delete', title: 'Delete', destructive: true, onPress: () => model.requestDelete(entry) }
	);
	return items;
}

function FilesBrowser({
	model,
	folderPath,
	push
}: {
	model: Model;
	folderPath: string;
	push: (d: ProjectFilesDestination) => void;
}) {
	const [refreshing, setRefreshing] = useState(false);
	const children = model.childEntries(folderPath);
	const rowStyle = {
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 56,
		justifyContent: 'center' as const
	};
	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={{ paddingBottom: 32 }}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={() => {
						setRefreshing(true);
						void model.refresh().finally(() => setRefreshing(false));
					}}
					colors={[systemColors.blue]}
				/>
			}
		>
			{model.readOnlyReason !== undefined ? (
				<M3Section>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}>
						<Icon name="lock" size={14} color={colors.secondaryLabel} />
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel, flex: 1 }]}>
							{model.readOnlyReason}
						</Text>
					</View>
				</M3Section>
			) : null}

			<M3Section>
				{folderPath === '' ? (
					<>
						<LongPressMenu items={[]} onPress={() => push({ kind: 'compose' })} style={rowStyle}>
							<ProjectFileBrowserRow
								name={model.composeFileName}
								systemImage="doc.text"
								isDirectory={false}
								hasChanges={model.composeChanged}
							/>
						</LongPressMenu>
						<LongPressMenu items={[]} onPress={() => push({ kind: 'env' })} style={rowStyle}>
							<ProjectFileBrowserRow
								name=".env"
								systemImage="key.horizontal"
								isDirectory={false}
								hasChanges={model.envChanged}
							/>
						</LongPressMenu>
					</>
				) : null}
				{children.length === 0 && folderPath !== '' ? (
					<View
						style={{ alignItems: 'center', gap: 12, paddingVertical: 36, paddingHorizontal: 16 }}
					>
						<Icon name="folder" size={40} color={colors.secondaryLabel} />
						<Text style={[m3Type.titleMedium, { color: colors.label }]}>Empty Folder</Text>
						<Text
							style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}
						>
							{model.emptyStateMessage}
						</Text>
					</View>
				) : (
					children.map((entry) => (
						<LongPressMenu
							key={entry.id}
							items={entryMenu(model, entry)}
							title={entry.name}
							onPress={() =>
								push(
									entry.isDirectory
										? { kind: 'folder', path: entry.relativePath }
										: { kind: 'managedFile', path: entry.relativePath }
								)
							}
							style={rowStyle}
						>
							<ProjectFileBrowserRow
								name={entry.name}
								detail={model.browserRowDetail(entry)}
								systemImage={entry.isDirectory ? 'folder.fill' : 'doc.text'}
								isDirectory={entry.isDirectory}
								isProtected={isProtectedEntry(entry)}
								hasChanges={entry.pending || model.fileHasUnsavedContent(entry.relativePath)}
								isLoading={model.managedFileIsLoading(entry.relativePath)}
							/>
						</LongPressMenu>
					))
				)}
			</M3Section>

			{model.hasChanges ? (
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 8,
						paddingHorizontal: 32,
						paddingTop: 16
					}}
				>
					<View
						style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: systemColors.orange }}
					/>
					<Text style={[m3Type.bodySmall, { color: systemColors.orange }]}>Unsaved changes</Text>
				</View>
			) : null}
			{model.errorMessage !== undefined ? (
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 8,
						paddingHorizontal: 32,
						paddingTop: 12
					}}
				>
					<Icon name="exclamationmark.triangle" size={14} color={systemColors.red} />
					<Text style={[m3Type.bodySmall, { color: systemColors.red, flex: 1 }]}>
						{model.errorMessage}
					</Text>
				</View>
			) : null}
		</ScrollView>
	);
}

function WorkspaceContent({
	model,
	destination,
	push,
	navigation
}: {
	model: Model;
	destination: ProjectFilesDestination;
	push: (d: ProjectFilesDestination) => void;
	navigation: ComposeNavigation;
}) {
	switch (destination.kind) {
		case 'compose':
			if (model.previewEnabled) {
				return (
					<NativeEditor
						model={model}
						session={`project-compose:${model.projectID}`}
						screen="editor"
						title={model.composeFileName}
						text={model.composeContent}
						setText={model.setComposeContent}
						readOnly={!model.canEdit}
						folderPath=""
						navigation={navigation}
					/>
				);
			}
			return (
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
		case 'env':
			if (model.previewEnabled) {
				return (
					<NativeEditor
						model={model}
						session={`project-env:${model.projectID}`}
						screen="envEditor"
						title=".env"
						text={model.envContent}
						setText={model.setEnvContent}
						readOnly={!model.canEdit}
						folderPath=""
						navigation={navigation}
					/>
				);
			}
			return (
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
		case 'files':
			return <FilesBrowser model={model} folderPath="" push={push} />;
		case 'folder':
			return <FilesBrowser model={model} folderPath={destination.path} push={push} />;
		case 'managedFile':
			return <ManagedFileEditor model={model} path={destination.path} navigation={navigation} />;
	}
}

export function ProjectFilesScreen() {
	const model = useProjectFilesWorkspace();
	const [path, setPath] = useState<ProjectFilesDestination[]>([]);
	const current = path[path.length - 1] ?? model.selected;
	const isRoot = path.length === 0;
	const push = (destination: ProjectFilesDestination) =>
		setPath((stack) => [...stack, destination]);
	const pop = () => setPath((stack) => stack.slice(0, -1));

	useFocusEffect(
		useCallback(() => {
			const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
				if (path.length > 0) pop();
				else model.done();
				return true;
			});
			return () => subscription.remove();
		}, [path.length, model])
	);

	const nav = useProjectNavigation();
	const [chromeItems, setChromeItems] = useState<AndroidToolbarItem[]>([]);
	const navigation = useMemo<ComposeNavigation>(
		() => ({
			push: (destination) => nav.openComposeEditor(encodeComposeDestination(destination)),
			mode: 'embedded',
			setChromeItems
		}),
		[nav]
	);
	const combined =
		model.previewEnabled &&
		(current.kind === 'compose' ||
			current.kind === 'env' ||
			(current.kind === 'managedFile' && nativeManagedScreen(model, current.path) !== undefined));

	const folderPath = destinationFolderPath(current);
	const menu: AndroidMenuItem[] = [
		{
			id: 'new-file',
			title: 'New File',
			disabled: !model.canEdit,
			onPress: () => model.newFile(folderPath)
		},
		{
			id: 'new-folder',
			title: 'New Folder',
			disabled: !model.canEdit,
			onPress: () => model.newFolder(folderPath)
		},
		{ id: 'reload', title: 'Reload', onPress: model.reload }
	];
	const previewMenu: AndroidMenuItem[] = projectFileActions(model, folderPath).map((action) => ({
		id: action.id,
		title: action.title,
		disabled: action.disabled,
		onPress: action.onPress
	}));
	const loading = model.isLoading && !model.hasLoaded;

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen
				options={{
					title: loading ? 'Project Files' : destinationTitle(model, current),
					gestureEnabled: !model.hasChanges,
					headerBackVisible: false
				}}
			/>
			<AndroidToolbar
				placement="left"
				items={[
					isRoot
						? { kind: 'button', id: 'done', icon: 'xmark', label: 'Done', onPress: model.done }
						: { kind: 'button', id: 'back', icon: 'chevron.left', label: 'Back', onPress: pop }
				]}
			/>
			<AndroidToolbar
				items={[
					...(combined
						? chromeItems
						: [
								model.previewEnabled
									? ({
											kind: 'menu',
											id: 'add',
											icon: 'ellipsis',
											label: 'Project file actions',
											items: previewMenu
										} as const)
									: ({
											kind: 'menu',
											id: 'add',
											icon: 'plus',
											label: 'Add file or folder',
											items: menu
										} as const)
							]),
					model.isSaving
						? { kind: 'spinner', id: 'save', label: 'Save' }
						: {
								kind: 'button',
								id: 'save',
								icon: 'checkmark',
								label: 'Save',
								disabled: !model.canEdit || !model.hasChanges,
								onPress: model.save
							}
				]}
			/>
			{loading ? (
				<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
					<ArcaneLoadingView label="Loading files..." />
				</View>
			) : (
				<View style={{ flex: 1 }} pointerEvents={model.isSaving ? 'none' : 'auto'}>
					<WorkspaceContent
						model={model}
						destination={current}
						push={push}
						navigation={navigation}
					/>
				</View>
			)}
			{model.isSaving ? (
				<View style={{ position: 'absolute', top: 8, alignSelf: 'center' }}>
					<ActivityIndicator />
				</View>
			) : null}
			<DeleteConfirmationHost hostID={projectFilesConfirmationHost} />
		</View>
	);
}
