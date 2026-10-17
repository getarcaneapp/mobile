/**
 * Models behind `VolumeWorkspaceView` (VolumeWorkspaceView.swift): the folder
 * listing, add / upload / delete, and the rename / move / new file / new
 * folder action sheet.
 */
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import { localizedStandardCompare } from '@/core/list-sort-order';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ProjectFile } from '@/sdk/models/project/ProjectFiles';
import { Permission } from '@/sdk/models/role/Permission';
import type { VolumeWorkspaceOperation } from '@/sdk/models/volume/VolumeWorkspace';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { uuidString } from './volume-model';
import { useVolumeNavigation } from './volume-routes';
import {
	confirmationDialog,
	makeTemporaryDirectory,
	removeItem,
	VolumeWorkspaceDraft
} from './volume-support';
import { useWorkspaceEntry, workspaceIdentity, WorkspaceStore } from './workspace-store';
import { pickedFileName } from '@/core/picked-file-name';

const parentOf = (relativePath: string) => relativePath.split('/').slice(0, -1).join('/');
const joinedPath = (directory: string, name: string) =>
	directory === '' ? name : `${directory}/${name}`;

export function useVolumeWorkspace(environmentID: EnvironmentID, volumeName: string) {
	const nav = useVolumeNavigation();
	const state = useWorkspaceEntry(environmentID, volumeName);
	const [directory, setDirectory] = useState('');
	useClientManager((s) => s.accessGeneration);
	const generation = useClientManager((s) => s.clientGeneration);
	const userID = useClientManager((s) => s.currentUser?.id);
	const canUpload = hasPermission(Permission.Volumes.upload, environmentID);
	const canDelete = hasPermission(Permission.Volumes.delete, environmentID);

	// `.task(id: identity)`: start over, then load.
	const identity = `${generation}|${userID ?? ''}|${environmentID}|${volumeName}`;
	useEffect(() => {
		WorkspaceStore.reset(environmentID, volumeName);
		setDirectory('');
		void WorkspaceStore.load(environmentID, volumeName);
	}, [identity, environmentID, volumeName]);
	useEffect(
		() => () => WorkspaceStore.remove(environmentID, volumeName),
		[environmentID, volumeName]
	);

	const entries = useMemo(
		() =>
			(state.workspace?.files ?? [])
				.filter((file) => parentOf(file.relativePath) === directory)
				.sort((lhs, rhs) =>
					lhs.isDirectory !== rhs.isDirectory
						? lhs.isDirectory
							? -1
							: 1
						: localizedStandardCompare(lhs.name, rhs.name)
				),
		[state.workspace, directory]
	);

	const apply = WorkspaceStore.apply.bind(null, environmentID, volumeName);

	const uploadFiles = async () => {
		try {
			const result = await File.pickFileAsync({ multipleFiles: true });
			if (result.canceled) return;
			const files = result.result;
			await apply(
				files.map((file, index) => ({
					operation: 'create_file' as const,
					relativePath: joinedPath(directory, pickedFileName(file)),
					uploadIndex: index
				})),
				files.map((file) => file.uri)
			);
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	return {
		environmentID,
		volumeName,
		state,
		directory,
		entries,
		title: directory === '' ? volumeName : directory,
		canUpload,
		canDelete,
		showsAddMenu: canUpload && state.workspace !== undefined,
		canRenameOrMove: (file: ProjectFile) => canUpload && canDelete && file.isSymlink !== true,
		load: () => WorkspaceStore.load(environmentID, volumeName),
		goToParent: () => setDirectory((d) => parentOf(d)),
		open: (file: ProjectFile) => {
			if (file.isDirectory) setDirectory(file.relativePath);
			else if (state.workspace) nav.openWorkspaceFile(environmentID, volumeName, file);
		},
		openAction: (action: VolumeWorkspaceOperation, file?: ProjectFile) =>
			nav.openWorkspaceAction(environmentID, volumeName, action, file?.relativePath, directory),
		uploadFiles: () => void uploadFiles(),
		requestDelete: (file: ProjectFile) =>
			confirmationDialog({
				title: `Delete ${file.relativePath}?`,
				message: 'Deleting a folder also deletes its contents.',
				actionTitle: 'Delete',
				onConfirm: () =>
					void apply([
						{ operation: 'delete', relativePath: file.relativePath, recursive: file.isDirectory }
					])
			})
	};
}

export type VolumeWorkspaceModel = ReturnType<typeof useVolumeWorkspace>;

/** `action.rawValue.replacingOccurrences(of: "_", with: " ").capitalized`. */
export function workspaceActionTitle(action: VolumeWorkspaceOperation | undefined) {
	if (!action) return 'File';
	return action
		.replace(/_/g, ' ')
		.toLowerCase()
		.replace(/(^|\s)(\S)/g, (_m, space: string, letter: string) => space + letter.toUpperCase());
}

/** The action sheet (Swift `.sheet(isPresented: action != nil)`). */
export function useWorkspaceAction({
	environmentID,
	volumeName,
	action,
	relativePath,
	directory
}: {
	environmentID: EnvironmentID;
	volumeName: string;
	action: VolumeWorkspaceOperation;
	relativePath?: string;
	directory: string;
}) {
	const router = useRouter();
	const state = useWorkspaceEntry(environmentID, volumeName);
	const actionFile = relativePath
		? state.workspace?.files.find((f) => f.relativePath === relativePath)
		: undefined;
	const [input, setInput] = useState(() =>
		action === 'rename' ? (relativePath?.split('/').pop() ?? '') : ''
	);
	// The session moved on: the sheet belongs to a workspace that's gone.
	const [identity] = useState(() => workspaceIdentity(environmentID, volumeName));
	const generation = useClientManager((s) => s.clientGeneration);
	useEffect(() => {
		if (workspaceIdentity(environmentID, volumeName) !== identity) router.back();
	}, [generation, environmentID, volumeName, identity, router]);

	const validInput =
		action === 'move'
			? input === '' || VolumeWorkspaceDraft.validRelativePath(input)
			: VolumeWorkspaceDraft.validRelativePath(input) && !input.includes('/');

	const applyAction = async () => {
		if (!validInput) return;
		const path = actionFile?.relativePath ?? relativePath ?? joinedPath(directory, input);
		if (action === 'create_file') {
			const temp = makeTemporaryDirectory();
			try {
				const file = new File(temp, uuidString());
				file.create();
				if (
					await WorkspaceStore.apply(
						environmentID,
						volumeName,
						[{ operation: action, relativePath: path, uploadIndex: 0 }],
						[file.uri]
					)
				) {
					router.back();
				}
			} catch (error) {
				showToast(Toasts.error(friendlyErrorMessage(error)));
			} finally {
				removeItem(temp);
			}
		} else if (
			await WorkspaceStore.apply(environmentID, volumeName, [
				{
					operation: action,
					relativePath: path,
					newName: action === 'rename' ? input : undefined,
					newParentPath: action === 'move' ? input : undefined
				}
			])
		) {
			router.back();
		}
	};

	return {
		action,
		title: workspaceActionTitle(action),
		placeholder: action === 'move' ? 'Destination folder, empty for root' : 'Name',
		isMove: action === 'move',
		input,
		setInput,
		errorMessage: state.errorMessage,
		canApply: !state.loading && validInput,
		apply: () => void applyAction(),
		refresh: () => void WorkspaceStore.load(environmentID, volumeName),
		cancel: () => router.back()
	};
}
