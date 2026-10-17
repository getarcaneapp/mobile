/**
 * Navigation for the Volumes destinations. Every route lives once in the
 * shared tab group, so pushes stay in whichever tab stack is current
 * (Swift: `navigationDestination` / `.sheet` on the presenting view).
 *
 * Objects that can't travel as route params (the Volume, a FileEntry, a
 * workspace file, callbacks) are handed over through `volumeCache` /
 * `routePayloads`.
 */
import { useRouter, useSegments, type Href } from 'expo-router';
import { useMemo } from 'react';

import { routePayloads } from '@/features/containers/container-routes';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ProjectFile } from '@/sdk/models/project/ProjectFiles';
import type { FileEntry } from '@/sdk/models/volume/Browse';
import type { Volume } from '@/sdk/models/volume/Volume';
import type { VolumeWorkspaceOperation } from '@/sdk/models/volume/VolumeWorkspace';

const key = (environmentID: EnvironmentID, name: string) => `${environmentID}/${name}`;

const volumes = new Map<string, Volume>();
const fileEntries = new Map<string, FileEntry>();
const workspaceFiles = new Map<string, ProjectFile>();

/** Last known values per volume, for a pushed screen's first render. */
export const volumeCache = {
	setVolume: (environmentID: EnvironmentID, volume: Volume) =>
		volumes.set(key(environmentID, volume.name), volume),
	volume: (environmentID: EnvironmentID, name: string) => volumes.get(key(environmentID, name)),
	setFileEntry: (environmentID: EnvironmentID, name: string, entry: FileEntry) =>
		fileEntries.set(`${key(environmentID, name)}:${entry.path}`, entry),
	fileEntry: (environmentID: EnvironmentID, name: string, path: string) =>
		fileEntries.get(`${key(environmentID, name)}:${path}`),
	setWorkspaceFile: (environmentID: EnvironmentID, name: string, file: ProjectFile) =>
		workspaceFiles.set(`${key(environmentID, name)}:${file.relativePath}`, file),
	workspaceFile: (environmentID: EnvironmentID, name: string, relativePath: string) =>
		workspaceFiles.get(`${key(environmentID, name)}:${relativePath}`)
};

export { routePayloads };

type Params = Record<string, string | undefined>;

function query(params: Params) {
	const entries = Object.entries(params).filter(
		(entry): entry is [string, string] => entry[1] !== undefined
	);
	return entries.length === 0
		? ''
		: `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export type VolumeSubpage =
	| 'browse'
	| 'file'
	| 'backups'
	| 'backup-files'
	| 'backup-policies'
	| 'backup-create'
	| 'rename'
	| 'workspace'
	| 'workspace-file'
	| 'workspace-action'
	| 'workspace-review';

/** Routes relative to the current tab's stack. */
export function useVolumeNavigation() {
	const router = useRouter();
	const segments = useSegments() as string[];
	const group =
		segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(volumes)';
	return useMemo(() => {
		const href = (path: string, params: Params = {}) =>
			`/(tabs)/${group}/${path}${query(params)}` as Href;
		const volumePath = (name: string, suffix = '') => `volume/${encodeURIComponent(name)}${suffix}`;
		const open = (
			page: VolumeSubpage,
			environmentID: EnvironmentID,
			name: string,
			params: Params = {}
		) => router.push(href(volumePath(name, `/${page}`), { envID: environmentID, ...params }));
		return {
			router,
			openDetail(environmentID: EnvironmentID, volume: Volume) {
				volumeCache.setVolume(environmentID, volume);
				router.push(href(volumePath(volume.name), { envID: environmentID }));
			},
			openBrowse: (environmentID: EnvironmentID, name: string) =>
				open('browse', environmentID, name),
			openBackups: (environmentID: EnvironmentID, name: string) =>
				open('backups', environmentID, name),
			openFileDetail(environmentID: EnvironmentID, name: string, entry: FileEntry) {
				volumeCache.setFileEntry(environmentID, name, entry);
				open('file', environmentID, name, { path: entry.path });
			},
			openWorkspace: (environmentID: EnvironmentID, name: string) =>
				open('workspace', environmentID, name),
			openWorkspaceFile(environmentID: EnvironmentID, name: string, file: ProjectFile) {
				volumeCache.setWorkspaceFile(environmentID, name, file);
				open('workspace-file', environmentID, name, { relativePath: file.relativePath });
			},
			openWorkspaceAction(
				environmentID: EnvironmentID,
				name: string,
				action: VolumeWorkspaceOperation,
				relativePath: string | undefined,
				directory: string
			) {
				open('workspace-action', environmentID, name, { action, relativePath, directory });
			},
			openWorkspaceReview: (environmentID: EnvironmentID, name: string, token: string) =>
				open('workspace-review', environmentID, name, { token }),
			openBackupFiles: (
				environmentID: EnvironmentID,
				name: string,
				backupID: string,
				canRestore: boolean
			) =>
				open('backup-files', environmentID, name, { backupID, canRestore: canRestore ? '1' : '0' }),
			openBackupPolicies: (environmentID: EnvironmentID, name: string) =>
				open('backup-policies', environmentID, name),
			openBackupCreate: (environmentID: EnvironmentID, name: string, token: string) =>
				open('backup-create', environmentID, name, { token }),
			/** `popsDetail`: the detail screen goes away with the sheet once the rename succeeds. */
			openRename: (environmentID: EnvironmentID, name: string, popsDetail: boolean) =>
				open('rename', environmentID, name, { popsDetail: popsDetail ? '1' : undefined }),
			openCreate: (environmentID: EnvironmentID) =>
				router.push(href('volume-create', { envID: environmentID })),
			openFilter: (listKey: string) => router.push(href('volumes-filter', { key: listKey }))
		};
	}, [router, group]);
}
