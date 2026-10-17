import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	ContextMenu,
	Form,
	Label,
	List,
	NavigationStack,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	disabled,
	font,
	foregroundStyle,
	navigationTitle,
	refreshable,
	textInputAutocapitalization
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import type { ProjectFile } from '@/sdk/models/project/ProjectFiles';
import type { VolumeWorkspaceOperation } from '@/sdk/models/volume/VolumeWorkspace';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { AppToolbar } from '@/ui/components/toolbar';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { BoundTextField } from '@/features/containers/swiftui-text-field';

import {
	useVolumeWorkspace,
	useWorkspaceAction,
	type VolumeWorkspaceModel
} from './use-volume-workspace';

function WorkspaceRow({ model, file }: { model: VolumeWorkspaceModel; file: ProjectFile }) {
	const label = (
		<Button onPress={() => model.open(file)}>
			<Label title={file.name} systemImage={file.isDirectory ? 'folder' : 'doc.text'} />
		</Button>
	);
	const renameOrMove = model.canRenameOrMove(file);
	if (!renameOrMove && !model.canDelete) return label;
	return (
		<ContextMenu>
			<ContextMenu.Trigger>{label}</ContextMenu.Trigger>
			<ContextMenu.Items>
				{renameOrMove ? (
					<>
						<Button label="Rename" onPress={() => model.openAction('rename', file)} />
						<Button label="Move" onPress={() => model.openAction('move', file)} />
					</>
				) : null}
				{model.canDelete ? (
					<Button label="Delete" role="destructive" onPress={() => model.requestDelete(file)} />
				) : null}
			</ContextMenu.Items>
		</ContextMenu>
	);
}

export function VolumeWorkspaceScreen() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const model = useVolumeWorkspace(envID, name);
	const { state } = model;
	const icon = useToolbarIcons(['plus']);

	return (
		<>
			<Stack.Screen options={{ title: model.title, headerLargeTitleEnabled: false }} />
			{model.showsAddMenu ? (
				<AppToolbar>
					<Stack.Toolbar.Menu
						icon={icon('plus')}
						title="Add"
						accessibilityLabel="Add"
						disabled={state.loading}
					>
						<Stack.Toolbar.MenuAction onPress={() => model.openAction('create_file')}>
							New file
						</Stack.Toolbar.MenuAction>
						<Stack.Toolbar.MenuAction onPress={() => model.openAction('create_folder')}>
							New folder
						</Stack.Toolbar.MenuAction>
						<Stack.Toolbar.MenuAction onPress={model.uploadFiles}>
							Upload files
						</Stack.Toolbar.MenuAction>
					</Stack.Toolbar.Menu>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<List modifiers={[refreshable(model.load)]}>
					{state.unsupported ? (
						<Text>
							This server does not support volume workspaces. Use the file browser to inspect this
							volume.
						</Text>
					) : null}
					{state.errorMessage !== undefined ? (
						<Text modifiers={[foregroundStyle(systemColors.red)]}>{state.errorMessage}</Text>
					) : null}
					{state.workspace?.fileTreeTruncated ? (
						<Text modifiers={[foregroundStyle(systemColors.orange)]}>
							The server returned a partial file tree.
						</Text>
					) : null}
					{model.directory !== '' ? (
						<Button label="Parent folder" systemImage="arrow.up" onPress={model.goToParent} />
					) : null}
					{model.entries.map((file) => (
						<WorkspaceRow key={file.relativePath} model={model} file={file} />
					))}
					{state.loading ? (
						<ArcaneLoadingViewSwiftUI />
					) : model.entries.length === 0 && state.workspace !== undefined ? (
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							Empty folder
						</Text>
					) : null}
				</List>
			</Host>
		</>
	);
}

export function VolumeWorkspaceActionScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const params = useLocalSearchParams<{
		name?: string;
		envID?: string;
		action?: string;
		relativePath?: string;
		directory?: string;
	}>();
	const model = useWorkspaceAction({
		environmentID: params.envID ?? '0',
		volumeName: params.name ?? '',
		action: (params.action ?? 'create_file') as VolumeWorkspaceOperation,
		relativePath: params.relativePath,
		directory: params.directory ?? ''
	});
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form modifiers={[navigationTitle(model.title)]}>
						<BoundTextField
							placeholder={model.placeholder}
							value={model.input}
							onChangeText={model.setInput}
							modifiers={[textInputAutocapitalization('never'), autocorrectionDisabled()]}
						/>
						{model.isMove ? (
							<Text modifiers={[font({ textStyle: 'caption' })]}>
								Enter a path relative to the volume root.
							</Text>
						) : null}
						{model.errorMessage !== undefined ? (
							<>
								<Text modifiers={[foregroundStyle(systemColors.red)]}>{model.errorMessage}</Text>
								<Button label="Refresh server files" onPress={model.refresh} />
							</>
						) : null}
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Cancel" onPress={model.cancel} modifiers={toolbarSymbol} />
						</ToolbarItem>
						<ToolbarItem placement="confirmationAction">
							<Button
								label="Apply"
								onPress={model.apply}
								modifiers={[disabled(!model.canApply), ...toolbarSymbol]}
							/>
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
