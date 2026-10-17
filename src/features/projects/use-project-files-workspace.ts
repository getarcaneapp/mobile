/**
 * `ProjectFilesWorkspaceView` state (ProjectFilesWorkspaceView.swift): the
 * compose / .env drafts, the staged file-tree changes, lazily loaded managed
 * file contents, the file dialogs, and save (compose + .env through the
 * project update, everything else through the workspace manifest).
 *
 * With the native Compose editor preview (`ComposePreviewSession`, captured
 * once per sheet) Save opens Review Changes (with Save and deploy), YAML
 * syntax is checked before saving, and the menus offer Deploy Saved Project.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import { cachedClient } from '@/core/networking/use-cached-client';
import { storage } from '@/core/storage';
import { makeComposePreviewSession } from '@/features/compose/model/compose-preview-session';
import { ProjectDraftReview } from '@/features/compose/model/project-draft-snapshot';
import type { DeployOptions } from '@/sdk/models/project/Project';
import type { ProjectFile, ProjectFileChange } from '@/sdk/models/project/ProjectFiles';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { useProjectDeploymentStore } from '@/stores/project-deployment-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import {
	useDeleteConfirmation,
	useItemDeleteConfirmation
} from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import {
	decodeDestination,
	formatFileBytes,
	isProtectedEntry,
	ProjectFileWorkspaceHelpers,
	sameDestination,
	type ManagedProjectFileEntry,
	type ProjectFileDialog,
	type ProjectFileDialogResult,
	type ProjectFilesDestination
} from './project-files-model';
import { projectDisplayName } from './project-model';
import { projectCache, useProjectNavigation } from './project-routes';

export const projectFilesConfirmationHost = 'project-files';

const overrideNames = [
	'compose.override.yml',
	'compose.override.yaml',
	'docker-compose.override.yml',
	'docker-compose.override.yaml'
];

function readOnlyReasonFor(project: { isArchived: boolean; gitOpsManagedBy?: string } | undefined) {
	if (project?.isArchived) return 'Archived projects are read-only.';
	if (project?.gitOpsManagedBy !== undefined) return 'GitOps-managed project files are read-only.';
	return undefined;
}

export function useProjectFilesWorkspace() {
	const router = useRouter();
	const nav = useProjectNavigation();
	const {
		envID = '0',
		projectID = '',
		selection
	} = useLocalSearchParams<{ envID?: string; projectID?: string; selection?: string }>();
	const [initialProject] = useState(() => projectCache.get(envID, projectID));
	const [sessionIdentity] = useState(() => useClientManager.getState().cacheSessionIdentity);
	useClientManager((s) => s.accessGeneration);
	const currentSession = useClientManager((s) => s.cacheSessionIdentity);

	const [selected, setSelected] = useState<ProjectFilesDestination>(() =>
		decodeDestination(selection)
	);
	const [projectName, setProjectName] = useState(
		initialProject ? projectDisplayName(initialProject) : ''
	);
	const [composeFileName, setComposeFileName] = useState('compose.yml');
	const [composeContent, setComposeContent] = useState('');
	const [envContent, setEnvContent] = useState('');
	const [originalComposeContent, setOriginalComposeContent] = useState('');
	const [originalEnvContent, setOriginalEnvContent] = useState('');
	const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
	const [composeRelatedPaths, setComposeRelatedPaths] = useState<Set<string>>(new Set());
	const [fileTreeRevision, setFileTreeRevision] = useState<string>();
	const [stagedChanges, setStagedChanges] = useState<ProjectFileChange[]>([]);
	const [managedFileContents, setManagedFileContents] = useState<Record<string, string>>({});
	const [originalManagedFileContents, setOriginalManagedFileContents] = useState<
		Record<string, string>
	>({});
	const [managedFileLoadErrors, setManagedFileLoadErrors] = useState<Record<string, string>>({});
	const [managedFileLoading, setManagedFileLoading] = useState<Set<string>>(new Set());
	const [readOnlyReason, setReadOnlyReason] = useState(() => readOnlyReasonFor(initialProject));
	const [hasLoaded, setHasLoaded] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [showDiscard, setShowDiscard] = useState(false);
	const [showReloadConfirmation, setShowReloadConfirmation] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<ManagedProjectFileEntry>();
	// `@State private var previewSession = ComposePreviewSession()`.
	const [previewSession] = useState(() => makeComposePreviewSession(storage.bool));
	const previewEnabled = previewSession.isEnabled;
	const [requestedDeployOptions, setRequestedDeployOptions] = useState<DeployOptions>();

	const sessionIsCurrent = () =>
		sessionIdentity === useClientManager.getState().cacheSessionIdentity &&
		useClientManager.getState().acceptsEnvironmentContext(envID);
	const sessionCurrent =
		sessionIdentity === currentSession &&
		useClientManager.getState().acceptsEnvironmentContext(envID);
	const canEdit =
		readOnlyReason === undefined &&
		sessionCurrent &&
		hasPermission(Permission.Projects.update, envID);

	const hasCoreChanges =
		composeContent !== originalComposeContent || envContent !== originalEnvContent;
	const changedManagedFilePaths = useMemo(
		() =>
			Object.keys(managedFileContents)
				.filter((path) => managedFileContents[path] !== originalManagedFileContents[path])
				.sort(),
		[managedFileContents, originalManagedFileContents]
	);
	const hasManagedChanges = stagedChanges.length > 0 || changedManagedFilePaths.length > 0;
	const hasChanges = hasCoreChanges || hasManagedChanges;

	const displayedFiles = useMemo(
		() => ProjectFileWorkspaceHelpers.apply(projectFiles, stagedChanges),
		[projectFiles, stagedChanges]
	);
	const displayedPathSet = useMemo(
		() => new Set(displayedFiles.map((entry) => entry.relativePath)),
		[displayedFiles]
	);

	const latest = useRef({ managedFileContents, displayedFiles });
	latest.current = { managedFileContents, displayedFiles };

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	// MARK: Loading

	const loadFiles = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!sessionIsCurrent() || !client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		try {
			try {
				const compose = await client.projects.compose({ envID, projectID });
				if (!sessionIsCurrent()) return;
				setProjectName(projectDisplayName(compose));
				setComposeRelatedPaths(
					new Set([
						...(compose.includeFiles ?? []).map((file) => file.relativePath),
						...overrideNames
					])
				);
				setComposeFileName(compose.composeFileName ? compose.composeFileName : 'compose.yml');
				setComposeContent(compose.composeContent ?? '');
				setEnvContent(compose.envContent ?? '');
				setOriginalComposeContent(compose.composeContent ?? '');
				setOriginalEnvContent(compose.envContent ?? '');
				setReadOnlyReason(readOnlyReasonFor(compose));
			} catch (error) {
				setErrorMessage(friendlyErrorMessage(error));
			}

			try {
				const workspace = await client.projects.workspace({ envID, projectID });
				if (!sessionIsCurrent()) return;
				setProjectFiles(workspace.files);
				setFileTreeRevision(workspace.fileTreeRevision);
				setStagedChanges([]);
				setManagedFileContents({});
				setOriginalManagedFileContents({});
				setManagedFileLoadErrors({});
				setManagedFileLoading(new Set());
			} catch (error) {
				setErrorMessage(friendlyErrorMessage(error));
			}
		} finally {
			setIsLoading(false);
			setHasLoaded(true);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [envID, projectID]);

	useEffect(() => {
		void loadFiles();
	}, [loadFiles]);

	const loadManagedFileContent = useCallback(
		async (path: string, force = false) => {
			if (!force && latest.current.managedFileContents[path] !== undefined) return;
			if (
				latest.current.displayedFiles.find((entry) => entry.relativePath === path)?.isDirectory ===
				true
			)
				return;
			const client = useClientManager.getState().client;
			if (!sessionIsCurrent() || !client) return;
			setManagedFileLoading((current) => new Set(current).add(path));
			setManagedFileLoadErrors((current) =>
				ProjectFileWorkspaceHelpers.removeRecord(current, path)
			);
			try {
				const file = await client.projects.workspaceFile({ envID, projectID, relativePath: path });
				if (!sessionIsCurrent()) return;
				const content = file.content ?? '';
				setManagedFileContents((current) => ({ ...current, [path]: content }));
				setOriginalManagedFileContents((current) => ({ ...current, [path]: content }));
			} catch (error) {
				setManagedFileLoadErrors((current) => ({
					...current,
					[path]: friendlyErrorMessage(error)
				}));
			} finally {
				setManagedFileLoading((current) => {
					const next = new Set(current);
					next.delete(path);
					return next;
				});
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[envID, projectID]
	);

	// MARK: Save

	const isDeleted = (path: string, changes: ProjectFileChange[]) =>
		changes.some(
			(change) =>
				change.operation === 'delete' &&
				ProjectFileWorkspaceHelpers.pathMatches(path, change.relativePath)
		);

	const buildProjectFileSaveChanges = (): ProjectFileChange[] => {
		const changes = stagedChanges.map((change) => ({ ...change }));
		const contentChanges: Record<string, string> = {};
		for (const path of changedManagedFilePaths) {
			const content = managedFileContents[path];
			if (content !== undefined) contentChanges[path] = content;
		}
		const createFilePaths = new Set<string>();
		for (const change of changes) {
			if (change.operation !== 'create_file') continue;
			createFilePaths.add(change.relativePath);
			const content = contentChanges[change.relativePath];
			if (content !== undefined) change.content = content;
			else if (change.content === undefined) change.content = '';
		}
		for (const [path, content] of Object.entries(contentChanges).sort(([a], [b]) =>
			a < b ? -1 : a > b ? 1 : 0
		)) {
			if (createFilePaths.has(path) || isDeleted(path, changes)) continue;
			changes.push({ operation: 'update_file', relativePath: path, content });
		}
		return changes;
	};

	const invalidate = () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		cachedClient()?.invalidate(envID, [
			client.rest.environmentPath(envID, 'projects') + '*',
			client.rest.environmentPath(envID, 'projects/*')
		]);
	};

	/** This project's environment, which can differ from the active one in All Environments lists. */
	const environmentName = () =>
		useEnvironmentsStore.getState().displayName(envID) ??
		useClientManager.getState().activeEnvironmentName;

	const saveChanges = async (deploy = false, deployOptions?: DeployOptions) => {
		const client = useClientManager.getState().client;
		if (!canEdit || !hasChanges || !client) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		const fileChanges = buildProjectFileSaveChanges();
		let savedCoreFiles = false;
		try {
			if (previewEnabled) {
				ProjectDraftReview.validateSyntax({ compose: composeContent, environment: envContent });
				for (const change of fileChanges) {
					const lower = change.relativePath.toLowerCase();
					if ((lower.endsWith('.yml') || lower.endsWith('.yaml')) && change.content !== undefined) {
						ProjectDraftReview.validateSyntax({ compose: change.content, environment: '' });
					}
				}
			}
			// Core files lack an atomic revision token: refetch before any write.
			const latestCompose = await client.projects.compose({ envID, projectID });
			if (!sessionIsCurrent()) return;
			if (latestCompose.isArchived || latestCompose.gitOpsManagedBy !== undefined) {
				setReadOnlyReason('This project is read-only.');
				return;
			}
			if (
				(latestCompose.composeContent ?? '') !== originalComposeContent ||
				(latestCompose.envContent ?? '') !== originalEnvContent
			) {
				setErrorMessage(
					'Project files changed on the server. Copy your draft before reloading and applying your changes.'
				);
				showToast(Toasts.error('Server files changed. Your draft is preserved.'));
				return;
			}
			if (hasCoreChanges) {
				await client.projects.update({
					envID,
					projectID,
					request: {
						composeContent: composeContent !== originalComposeContent ? composeContent : undefined,
						envContent: envContent !== originalEnvContent ? envContent : undefined
					}
				});
				setOriginalComposeContent(composeContent);
				setOriginalEnvContent(envContent);
				savedCoreFiles = true;
			}
			if (!sessionIsCurrent()) return;
			if (fileChanges.length > 0) {
				await client.projects.updateWorkspace({
					envID,
					projectID,
					fileTreeRevision,
					changes: fileChanges
				});
			}
			if (!sessionIsCurrent()) return;
			showToast(Toasts.success('Saved'));
			if (deploy && hasPermission(Permission.Projects.deploy, envID)) {
				const started = useProjectDeploymentStore.getState().start({
					kind: 'up',
					envID,
					targetID: projectID,
					targetName: projectName,
					environmentName: environmentName(),
					deployOptions,
					presentSheet: nav.openDeployment
				});
				if (!started)
					showToast(Toasts.info('Files saved. Use Deploy Saved Project to try deployment again.'));
			}
			invalidate();
			useResourceMutationStore.getState().markChanged('projects', envID);
			await loadFiles();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
			showToast(
				Toasts.error(
					savedCoreFiles
						? 'Compose and environment saved; additional files could not be saved.'
						: "Couldn't save"
				)
			);
			if (savedCoreFiles && sessionIsCurrent()) {
				invalidate();
				useResourceMutationStore.getState().markChanged('projects', envID);
			}
		} finally {
			setIsSaving(false);
		}
	};

	// MARK: Staging

	const remapManagedState = (oldPath: string, newPath: string) => {
		setManagedFileContents((current) =>
			ProjectFileWorkspaceHelpers.remapRecord(current, oldPath, newPath)
		);
		setOriginalManagedFileContents((current) =>
			ProjectFileWorkspaceHelpers.remapRecord(current, oldPath, newPath)
		);
		setManagedFileLoadErrors((current) =>
			ProjectFileWorkspaceHelpers.remapRecord(current, oldPath, newPath)
		);
		setManagedFileLoading(
			(current) =>
				new Set(
					[...current].map((path) =>
						ProjectFileWorkspaceHelpers.pathMatches(path, oldPath)
							? `${newPath}${path.slice(oldPath.length)}`
							: path
					)
				)
		);
	};

	const removeManagedState = (root: string) => {
		setManagedFileContents((current) => ProjectFileWorkspaceHelpers.removeRecord(current, root));
		setOriginalManagedFileContents((current) =>
			ProjectFileWorkspaceHelpers.removeRecord(current, root)
		);
		setManagedFileLoadErrors((current) => ProjectFileWorkspaceHelpers.removeRecord(current, root));
		setManagedFileLoading(
			(current) =>
				new Set([...current].filter((path) => !ProjectFileWorkspaceHelpers.pathMatches(path, root)))
		);
	};

	const submitFileDialog = (result: ProjectFileDialogResult): string | undefined => {
		switch (result.kind) {
			case 'createFile': {
				const path = ProjectFileWorkspaceHelpers.planCreate(
					displayedPathSet,
					result.parentPath,
					result.name,
					composeFileName
				);
				if (path === undefined) return 'Use a unique file name that is not reserved by Arcane.';
				setStagedChanges((current) => [
					...current,
					{ operation: 'create_file', relativePath: path, content: '' }
				]);
				setManagedFileContents((current) => ({ ...current, [path]: '' }));
				setSelected({ kind: 'managedFile', path });
				return undefined;
			}
			case 'createFolder': {
				const path = ProjectFileWorkspaceHelpers.planCreate(
					displayedPathSet,
					result.parentPath,
					result.name,
					composeFileName
				);
				if (path === undefined) return 'Use a unique folder name that is not reserved by Arcane.';
				setStagedChanges((current) => [
					...current,
					{ operation: 'create_folder', relativePath: path }
				]);
				return undefined;
			}
			case 'rename': {
				const plan = ProjectFileWorkspaceHelpers.planRename(
					displayedPathSet,
					result.path,
					result.newName,
					composeFileName
				);
				if (plan === undefined) return 'Use a unique file name that is not reserved by Arcane.';
				setStagedChanges((current) => [
					...current,
					{ operation: 'rename', relativePath: result.path, newName: plan.newName }
				]);
				remapManagedState(result.path, plan.newPath);
				if (sameDestination(selected, { kind: 'managedFile', path: result.path }))
					setSelected({ kind: 'managedFile', path: plan.newPath });
				return undefined;
			}
			case 'move': {
				const entry = displayedFiles.find((e) => e.relativePath === result.path);
				const newPath = entry
					? ProjectFileWorkspaceHelpers.planMove(
							entry,
							displayedPathSet,
							result.path,
							result.newParentPath
						)
					: undefined;
				if (newPath === undefined) return 'Choose a different destination folder.';
				setStagedChanges((current) => [
					...current,
					{ operation: 'move', relativePath: result.path, newParentPath: result.newParentPath }
				]);
				remapManagedState(result.path, newPath);
				if (sameDestination(selected, { kind: 'managedFile', path: result.path }))
					setSelected({ kind: 'managedFile', path: newPath });
				return undefined;
			}
		}
	};

	const stageDelete = (entry: ManagedProjectFileEntry) => {
		setStagedChanges((current) => [
			...current,
			{
				operation: 'delete',
				relativePath: entry.relativePath,
				recursive: entry.isDirectory ? true : undefined
			}
		]);
		removeManagedState(entry.relativePath);
		if (
			selected.kind === 'managedFile' &&
			ProjectFileWorkspaceHelpers.pathMatches(selected.path, entry.relativePath)
		) {
			setSelected({ kind: 'files' });
		}
	};

	const openFileDialog = (dialog: ProjectFileDialog) =>
		nav.openFileDialog({
			dialog,
			folders: displayedFiles.filter((entry) => entry.isDirectory),
			existingPaths: displayedPathSet,
			composeFileName,
			onSubmit: submitFileDialog
		});

	// MARK: Confirmations

	useDeleteConfirmation(
		showDiscard,
		setShowDiscard,
		{
			title: 'Discard unsaved changes?',
			actions: [{ title: 'Discard', action: dismiss }],
			dismissOnConfirm: false
		},
		projectFilesConfirmationHost
	);
	useDeleteConfirmation(
		showReloadConfirmation,
		setShowReloadConfirmation,
		{
			title: 'Reload and discard unsaved changes?',
			actions: [{ title: 'Reload', action: () => void loadFiles() }],
			dismissOnConfirm: false
		},
		projectFilesConfirmationHost
	);
	useItemDeleteConfirmation(
		pendingDelete,
		setPendingDelete,
		(entry) => ({
			title: entry.isDirectory ? 'Delete Folder' : 'Delete File',
			message: entry.isDirectory
				? `Delete ${entry.relativePath} and all files inside it.`
				: `Delete ${entry.relativePath}.`,
			icon: 'trash',
			actions: [{ title: 'Delete', action: () => stageDelete(entry) }],
			dismissOnConfirm: false
		}),
		projectFilesConfirmationHost
	);

	// MARK: Browser helpers

	const childEntries = (folderPath: string) =>
		displayedFiles.filter(
			(entry) => ProjectFileWorkspaceHelpers.parentPath(entry.relativePath) === folderPath
		);

	const fileHasUnsavedContent = (path: string) =>
		managedFileContents[path] !== undefined &&
		managedFileContents[path] !== originalManagedFileContents[path];

	/** Files-app-style subtitle: item count for folders, size for files. */
	const browserRowDetail = (entry: ManagedProjectFileEntry): string | undefined => {
		if (entry.isDirectory) {
			const count = childEntries(entry.relativePath).length;
			return count === 1 ? '1 item' : `${count} items`;
		}
		if (entry.pending && originalManagedFileContents[entry.relativePath] === undefined)
			return 'New file';
		return formatFileBytes(entry.size);
	};

	const entryFor = (path: string) => displayedFiles.find((entry) => entry.relativePath === path);

	return {
		environmentID: envID,
		projectID,
		selected,
		hasLoaded,
		isLoading,
		isSaving,
		errorMessage,
		readOnlyReason,
		canEdit,
		sessionIsCurrent: sessionCurrent,
		hasChanges,
		projectName,
		composeFileName,
		composeContent,
		setComposeContent,
		envContent,
		setEnvContent,
		composeChanged: composeContent !== originalComposeContent,
		envChanged: envContent !== originalEnvContent,
		composeRelatedPaths,
		displayedFiles,
		childEntries,
		browserRowDetail,
		fileHasUnsavedContent,
		entryFor,
		managedFileContent: (path: string) => managedFileContents[path],
		setManagedFileContent: (path: string, text: string) =>
			setManagedFileContents((current) => ({ ...current, [path]: text })),
		managedFileIsLoading: (path: string) => managedFileLoading.has(path),
		managedFileLoadError: (path: string) => managedFileLoadErrors[path],
		loadManagedFileContent,
		isEntryReadOnly: (path: string) =>
			!canEdit || (entryFor(path) !== undefined && isProtectedEntry(entryFor(path)!)),
		emptyStateMessage: canEdit
			? 'Add files or folders here with the + button.'
			: 'This folder is empty.',
		// Actions
		done: () => (hasChanges ? setShowDiscard(true) : dismiss()),
		reload: () => (hasChanges ? setShowReloadConfirmation(true) : void loadFiles()),
		refresh: async () => {
			if (hasChanges) setShowReloadConfirmation(true);
			else await loadFiles();
		},
		previewEnabled,
		canDeploy: hasPermission(Permission.Projects.deploy, envID),
		/** `saveButton`: Review Changes with the preview, a direct save without it. */
		save: () => {
			if (!previewEnabled) {
				void saveChanges();
				return;
			}
			nav.openDraftReview({
				originalCompose: originalComposeContent,
				compose: composeContent,
				environmentChanged: envContent !== originalEnvContent,
				additionalChanges: [
					...changedManagedFilePaths,
					...stagedChanges.map((change) => change.relativePath)
				],
				canDeploy: hasPermission(Permission.Projects.deploy, envID),
				onDismiss: (deploy) => {
					if (deploy && useClientManager.getState().supportsPost26MobileFeatures) {
						nav.openDeployOptions(envID, {
							deploy: (options) => {
								setRequestedDeployOptions(options);
								void saveChanges(true, options);
							}
						});
					} else {
						void saveChanges(deploy, requestedDeployOptions);
					}
				}
			});
		},
		/** "Deploy Saved Project" (preview menus). */
		deploySaved: () => {
			if (!sessionIsCurrent()) return;
			useProjectDeploymentStore.getState().start({
				kind: 'up',
				envID,
				targetID: projectID,
				targetName: projectName,
				environmentName: environmentName(),
				deployOptions: requestedDeployOptions,
				presentSheet: nav.openDeployment
			});
		},
		newFile: (parentPath: string) => openFileDialog({ kind: 'createFile', parentPath }),
		newFolder: (parentPath: string) => openFileDialog({ kind: 'createFolder', parentPath }),
		rename: (entry: ManagedProjectFileEntry) =>
			openFileDialog({ kind: 'rename', path: entry.relativePath, currentName: entry.name }),
		move: (entry: ManagedProjectFileEntry) =>
			openFileDialog({ kind: 'move', path: entry.relativePath }),
		requestDelete: setPendingDelete,
		resolveVariables: () =>
			nav.openRenderCompose(envID, {
				initialCompose: composeContent,
				initialEnv: envContent,
				onApply: setComposeContent
			})
	};
}

export type ProjectFilesWorkspaceModel = ReturnType<typeof useProjectFilesWorkspace>;

/** Title for a destination (`workspaceContent(for:)` navigation titles). */
export function destinationTitle(
	model: ProjectFilesWorkspaceModel,
	destination: ProjectFilesDestination
): string {
	switch (destination.kind) {
		case 'compose':
			return model.composeFileName;
		case 'env':
			return '.env';
		case 'files':
			return 'Project Files';
		case 'folder':
		case 'managedFile':
			return ProjectFileWorkspaceHelpers.basename(destination.path);
	}
}

/** Parent folder whose New File / New Folder actions an editor's menu targets. */
export function destinationFolderPath(destination: ProjectFilesDestination): string {
	switch (destination.kind) {
		case 'folder':
			return destination.path;
		case 'managedFile':
			return ProjectFileWorkspaceHelpers.parentPath(destination.path);
		default:
			return '';
	}
}
