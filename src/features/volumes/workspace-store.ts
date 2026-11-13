import { create } from 'zustand';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import {
	assembleWorkspaceFolders,
	mergeWorkspaceFolder,
	normalizeWorkspacePath,
	workspaceFolderChain
} from '@/core/workspace-folders';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import { Permission } from '@/sdk/models/role/Permission';
import type {
	VolumeWorkspace,
	VolumeWorkspaceFileChange
} from '@/sdk/models/volume/VolumeWorkspace';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

export type WorkspaceEntry = {
	identity: string;
	workspace?: VolumeWorkspace;
	loading: boolean;
	errorMessage?: string;
	unsupported: boolean;
	incremental: boolean;
	loadedFolders: readonly string[];
	loadingFolders: readonly string[];
};

const emptyEntry = (identity: string): WorkspaceEntry => ({
	identity,
	loading: false,
	unsupported: false,
	incremental: false,
	loadedFolders: [],
	loadingFolders: []
});

export function workspaceFolderReady(entry: WorkspaceEntry, folder: string): boolean {
	if (entry.workspace === undefined) return false;
	return !entry.incremental || entry.loadedFolders.includes(normalizeWorkspacePath(folder));
}

async function fetchFolders(
	client: ArcaneClient,
	environmentID: EnvironmentID,
	volumeName: string,
	folders: readonly string[]
) {
	const [root, ...rest] = ['', ...folders.filter((folder) => folder !== '')];
	const rootListing = await client.volumes.workspace({
		envID: environmentID,
		name: volumeName,
		path: root
	});
	const incremental = (await client.apiGeneration()) === 'v3';
	if (!incremental) return { workspace: rootListing, incremental, loaded: [''] };
	const others = await Promise.all(
		rest.map((path) =>
			client.volumes
				.workspace({ envID: environmentID, name: volumeName, path })
				.then((listing) => ({ path, files: listing.files, truncated: listing.fileTreeTruncated }))
				.catch(() => undefined)
		)
	);
	const assembled = assembleWorkspaceFolders([
		{ path: '', files: rootListing.files, truncated: rootListing.fileTreeTruncated },
		...others.filter((listing) => listing !== undefined)
	]);
	return {
		workspace: {
			...rootListing,
			files: assembled.files,
			fileTreeTruncated: assembled.truncated
		},
		incremental,
		loaded: assembled.loaded
	};
}

type Store = { entries: Record<string, WorkspaceEntry> };

export const useWorkspaceStore = create<Store>(() => ({ entries: {} }));

export const workspaceKey = (environmentID: EnvironmentID, volumeName: string) =>
	`${environmentID}|${volumeName}`;

export function workspaceIdentity(environmentID: EnvironmentID, volumeName: string) {
	const s = useClientManager.getState();
	return `${s.clientGeneration}|${s.client?.configuration.baseURL ?? ''}|${s.currentUser?.id ?? ''}|${environmentID}|${volumeName}`;
}

function entry(key: string): WorkspaceEntry | undefined {
	return useWorkspaceStore.getState().entries[key];
}

function patch(key: string, identity: string, values: Partial<WorkspaceEntry>) {
	useWorkspaceStore.setState((s) => {
		const current = s.entries[key];
		if (current && current.identity !== identity) return s;
		return {
			entries: { ...s.entries, [key]: { ...(current ?? emptyEntry(identity)), ...values } }
		};
	});
}

export function useWorkspaceEntry(
	environmentID: EnvironmentID,
	volumeName: string
): WorkspaceEntry {
	const key = workspaceKey(environmentID, volumeName);
	return useWorkspaceStore((s) => s.entries[key]) ?? emptyEntry('');
}

export const WorkspaceStore = {
	reset(environmentID: EnvironmentID, volumeName: string) {
		const key = workspaceKey(environmentID, volumeName);
		const identity = workspaceIdentity(environmentID, volumeName);
		useWorkspaceStore.setState((s) => ({ entries: { ...s.entries, [key]: emptyEntry(identity) } }));
	},

	remove(environmentID: EnvironmentID, volumeName: string) {
		const key = workspaceKey(environmentID, volumeName);
		useWorkspaceStore.setState((s) => {
			const { [key]: _removed, ...rest } = s.entries;
			return { entries: rest };
		});
	},

	async load(environmentID: EnvironmentID, volumeName: string, folders?: readonly string[]) {
		const client = useClientManager.getState().client;
		if (!client || !hasPermission(Permission.Volumes.read, environmentID)) return;
		const key = workspaceKey(environmentID, volumeName);
		const identity = workspaceIdentity(environmentID, volumeName);
		const isCurrent = () =>
			workspaceIdentity(environmentID, volumeName) === identity &&
			entry(key)?.identity === identity;
		const requested = folders ?? entry(key)?.loadedFolders ?? [];
		patch(key, identity, { loading: true });
		try {
			const result = await fetchFolders(client, environmentID, volumeName, requested);
			if (!isCurrent()) return;
			patch(key, identity, {
				workspace: result.workspace,
				incremental: result.incremental,
				loadedFolders: result.loaded,
				loadingFolders: [],
				errorMessage: undefined,
				unsupported: false
			});
		} catch (error) {
			if (!isCurrent()) return;
			patch(key, identity, {
				unsupported: isArcaneError(error, 'notFound'),
				errorMessage: friendlyErrorMessage(error)
			});
		} finally {
			if (isCurrent()) patch(key, identity, { loading: false });
		}
	},

	async loadFolder(environmentID: EnvironmentID, volumeName: string, folder: string) {
		const key = workspaceKey(environmentID, volumeName);
		const client = useClientManager.getState().client;
		const initial = entry(key);
		if (!client || !initial?.workspace || !initial.incremental || initial.loading) return;
		const identity = initial.identity;
		const isCurrent = () =>
			workspaceIdentity(environmentID, volumeName) === identity &&
			entry(key)?.identity === identity;
		for (const path of workspaceFolderChain(folder)) {
			const current = entry(key);
			if (!current?.workspace || current.identity !== identity) return;
			if (current.loadedFolders.includes(path) || current.loadingFolders.includes(path)) continue;
			if (!current.workspace.files.some((file) => file.isDirectory && file.relativePath === path))
				return;
			patch(key, identity, { loadingFolders: [...current.loadingFolders, path] });
			try {
				const listing = await client.volumes.workspace({
					envID: environmentID,
					name: volumeName,
					path
				});
				if (!isCurrent()) return;
				const latest = entry(key);
				if (!latest?.workspace) return;
				patch(key, identity, {
					workspace: {
						...latest.workspace,
						files: mergeWorkspaceFolder(latest.workspace.files, path, listing.files),
						fileTreeTruncated: latest.workspace.fileTreeTruncated || listing.fileTreeTruncated
					},
					loadedFolders: [...latest.loadedFolders.filter((loaded) => loaded !== path), path],
					loadingFolders: latest.loadingFolders.filter((loading) => loading !== path)
				});
			} catch (error) {
				if (!isCurrent()) return;
				const latest = entry(key);
				patch(key, identity, {
					loadingFolders: (latest?.loadingFolders ?? []).filter((loading) => loading !== path)
				});
				showToast(Toasts.error(friendlyErrorMessage(error)));
				return;
			}
		}
	},

	async apply(
		environmentID: EnvironmentID,
		volumeName: string,
		changes: VolumeWorkspaceFileChange[],
		files: string[] = []
	): Promise<boolean> {
		const key = workspaceKey(environmentID, volumeName);
		const current = entry(key);
		const client = useClientManager.getState().client;
		if (!current || current.loading || !client || !current.workspace) return false;
		const identity = current.identity;
		const isCurrent = () =>
			workspaceIdentity(environmentID, volumeName) === identity &&
			entry(key)?.identity === identity;
		patch(key, identity, { loading: true });
		try {
			const result = await client.volumes.updateWorkspace({
				envID: environmentID,
				name: volumeName,
				manifest: {
					fileTreeRevision: current.workspace.fileTreeRevision || undefined,
					fileChanges: changes
				},
				files
			});
			if (!isCurrent()) return false;
			if (result && !current.incremental) {
				patch(key, identity, { workspace: result, errorMessage: undefined });
			} else {
				patch(key, identity, { errorMessage: undefined, loading: false });
				await WorkspaceStore.load(environmentID, volumeName);
			}
			showToast(Toasts.success('Files updated'));
			return true;
		} catch (error) {
			if (!isCurrent()) return false;
			patch(key, identity, {
				errorMessage: isArcaneError(error, 'conflict')
					? 'Files changed on the server. Refresh and review them before retrying.'
					: friendlyErrorMessage(error)
			});
			return false;
		} finally {
			if (isCurrent()) patch(key, identity, { loading: false });
		}
	}
} as const;
