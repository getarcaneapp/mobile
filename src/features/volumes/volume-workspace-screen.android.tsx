/** Android renderings of `VolumeWorkspaceView` and its action sheet (VolumeWorkspaceView.swift). */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import type { ProjectFile } from '@/sdk/models/project/ProjectFiles';
import type { VolumeWorkspaceOperation } from '@/sdk/models/volume/VolumeWorkspace';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3 } from '@/ui/components/material-colors';

import { M3Section, M3TextField, TextButtonRow } from '@/features/containers/android-material';
import { AndroidToolbar, type AndroidToolbarItem } from '@/features/containers/android-toolbar';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';

import { IconRow, TextRow } from './android-rows';
import {
	useVolumeWorkspace,
	useWorkspaceAction,
	type VolumeWorkspaceModel
} from './use-volume-workspace';

function WorkspaceRow({ model, file }: { model: VolumeWorkspaceModel; file: ProjectFile }) {
	const items: RowMenuItem[] = [];
	if (model.canRenameOrMove(file)) {
		items.push({ id: 'rename', title: 'Rename', onPress: () => model.openAction('rename', file) });
		items.push({ id: 'move', title: 'Move', onPress: () => model.openAction('move', file) });
	}
	if (model.canDelete)
		items.push({
			id: 'delete',
			title: 'Delete',
			destructive: true,
			onPress: () => model.requestDelete(file)
		});
	return (
		<LongPressMenu
			items={items}
			title={file.name}
			onPress={() => model.open(file)}
			style={{ flexDirection: 'row', alignItems: 'center' }}
		>
			<View style={{ flex: 1 }} pointerEvents="none">
				<IconRow title={file.name} icon={file.isDirectory ? 'folder' : 'doc.text'} />
			</View>
		</LongPressMenu>
	);
}

export function VolumeWorkspaceScreen() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const model = useVolumeWorkspace(envID, name);
	const { state } = model;
	const [refreshing, setRefreshing] = useState(false);

	const toolbar: AndroidToolbarItem[] = model.showsAddMenu
		? [
				{
					kind: 'menu',
					id: 'add',
					icon: 'plus',
					label: 'Add',
					disabled: state.loading,
					items: [
						{ id: 'file', title: 'New file', onPress: () => model.openAction('create_file') },
						{ id: 'folder', title: 'New folder', onPress: () => model.openAction('create_folder') },
						{ id: 'upload', title: 'Upload files', onPress: model.uploadFiles }
					]
				}
			]
		: [];

	return (
		<>
			<Stack.Screen options={{ title: model.title }} />
			<AndroidToolbar items={toolbar} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.load().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				<M3Section>
					{state.unsupported ? (
						<TextRow text="This server does not support volume workspaces. Use the file browser to inspect this volume." />
					) : null}
					{state.errorMessage !== undefined ? (
						<TextRow text={state.errorMessage} color={systemColors.red} />
					) : null}
					{state.workspace?.fileTreeTruncated ? (
						<TextRow text="The server returned a partial file tree." color={systemColors.orange} />
					) : null}
					{model.directory !== '' ? (
						<IconRow
							title="Parent folder"
							icon="arrow.up"
							iconColor={m3.primary}
							onPress={model.goToParent}
						/>
					) : null}
					{model.entries.map((file) => (
						<WorkspaceRow key={file.relativePath} model={model} file={file} />
					))}
					{state.loading ? (
						<View style={{ padding: 16, alignItems: 'center' }}>
							<ArcaneLoadingView />
						</View>
					) : model.entries.length === 0 && state.workspace !== undefined ? (
						<TextRow text="Empty folder" color={colors.secondaryLabel} />
					) : null}
				</M3Section>
			</ScrollView>
		</>
	);
}

export function VolumeWorkspaceActionScreen() {
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
		<>
			<Stack.Screen options={{ title: model.title }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'apply',
						icon: 'checkmark',
						label: 'Apply',
						disabled: !model.canApply,
						onPress: model.apply
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section footer={model.isMove ? 'Enter a path relative to the volume root.' : undefined}>
					<M3TextField
						label={model.placeholder}
						value={model.input}
						onChangeText={model.setInput}
					/>
				</M3Section>
				{model.errorMessage !== undefined ? (
					<M3Section>
						<TextRow text={model.errorMessage} color={systemColors.red} />
						<TextButtonRow title="Refresh server files" onPress={model.refresh} />
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}
