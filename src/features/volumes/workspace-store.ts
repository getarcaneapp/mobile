/**
 * `VolumeWorkspaceView`'s workspace state (VolumeWorkspaceView.swift:
 * `workspace`, `loading`, `errorMessage`, `unsupported`, `load()`,
 * `apply(_:files:)`), kept per volume so the workspace screen and its sheets
 * (file action, file editor) share one source of truth.
 */
import { create } from 'zustand';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
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
};

const emptyEntry = (identity: string): WorkspaceEntry => ({
	identity,
	loading: false,
	unsupported: false
});

type Store = { entries: Record<string, WorkspaceEntry> };

export const useWorkspaceStore = create<Store>(() => ({ entries: {} }));

export const workspaceKey = (environmentID: EnvironmentID, volumeName: string) =>
	`${environmentID}|${volumeName}`;

/** Swift `identity`: session generation, server, user, environment, and volume. */
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
	/** `.task(id: identity)`: starts over for a new identity (workspace = nil). */
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

	async load(environmentID: EnvironmentID, volumeName: string) {
		const client = useClientManager.getState().client;
		if (!client || !hasPermission(Permission.Volumes.read, environmentID)) return;
		const key = workspaceKey(environmentID, volumeName);
		const identity = workspaceIdentity(environmentID, volumeName);
		const isCurrent = () =>
			workspaceIdentity(environmentID, volumeName) === identity &&
			entry(key)?.identity === identity;
		patch(key, identity, { loading: true });
		try {
			const result = await client.volumes.workspace({ envID: environmentID, name: volumeName });
			if (!isCurrent()) return;
			patch(key, identity, { workspace: result, errorMessage: undefined, unsupported: false });
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

	/** Swift `apply(_:files:)`. `files` are local file URIs. Resolves whether the change was applied. */
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
				manifest: { fileTreeRevision: current.workspace.fileTreeRevision, fileChanges: changes },
				files
			});
			if (!isCurrent()) return false;
			patch(key, identity, { workspace: result, errorMessage: undefined });
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
