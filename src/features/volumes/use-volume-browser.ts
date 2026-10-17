import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { localizedStandardCompare } from '@/core/list-sort-order';
import { ServerCapabilities } from '@/sdk/client/ServerCapabilities';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { FileEntry } from '@/sdk/models/volume/Browse';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';

import { useDebounced } from '@/features/containers/hooks';

import { containsCaseInsensitive } from './volume-model';
import { useVolumeNavigation } from './volume-routes';

export function pathSegments(path: string): string[] {
	return path.split('/').filter((part) => part.trim() !== '');
}

export function useVolumeBrowser(environmentID: EnvironmentID, volumeName: string) {
	const nav = useVolumeNavigation();
	const [segments, setSegments] = useState<string[]>([]);
	const [entries, setEntries] = useState<FileEntry[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [searchText, setSearchText] = useState('');
	const debouncedSearchText = useDebounced(searchText, 200);
	const loadGeneration = useRef(0);
	const entriesRef = useRef(entries);
	entriesRef.current = entries;
	const capabilities = useClientManager((s) => s.serverCapabilities);
	useClientManager((s) => s.accessGeneration);

	const currentPath = segments.length === 0 ? '/' : `/${segments.join('/')}`;
	const currentPathRef = useRef(currentPath);
	currentPathRef.current = currentPath;

	const displayedEntries = useMemo(() => {
		const query = debouncedSearchText.trim();
		const filtered =
			query === ''
				? entries
				: entries.filter((entry) => containsCaseInsensitive(entry.name, query));
		return [...filtered].sort((lhs, rhs) => {
			if (lhs.isDirectory !== rhs.isDirectory) return lhs.isDirectory ? -1 : 1;
			return localizedStandardCompare(lhs.name, rhs.name);
		});
	}, [entries, debouncedSearchText]);

	const loadEntries = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		loadGeneration.current += 1;
		const generation = loadGeneration.current;
		const requestedPath = currentPathRef.current;
		if (entriesRef.current.length === 0) setIsLoading(true);
		setErrorMessage(undefined);
		try {
			const nextEntries = await client.volumes.browse({
				envID: environmentID,
				name: volumeName,
				path: requestedPath
			});
			if (loadGeneration.current !== generation || requestedPath !== currentPathRef.current) return;
			setEntries(nextEntries);
		} catch (error) {
			if (loadGeneration.current !== generation || isCancellation(error)) return;
			setErrorMessage(friendlyErrorMessage(error));
			setEntries([]);
		} finally {
			if (loadGeneration.current === generation) setIsLoading(false);
		}
	}, [environmentID, volumeName]);

	useEffect(() => {
		void loadEntries();
	}, [currentPath, loadEntries]);

	useEffect(
		() => () => {
			loadGeneration.current += 1;
		},
		[]
	);

	const canManageFiles =
		capabilities !== undefined &&
		ServerCapabilities.supportsRoleManagement(capabilities) &&
		hasPermission(Permission.Volumes.read, environmentID);

	return {
		environmentID,
		volumeName,
		segments,
		currentPath,
		title: currentPath === '/' ? volumeName : currentPath,
		entries,
		displayedEntries,
		isLoading,
		errorMessage,
		searchText,
		setSearchText,
		canManageFiles,
		loadEntries,
		goUp: () => setSegments((s) => s.slice(0, -1)),
		goToRoot: () => setSegments([]),
		goToSegment: (index: number) => setSegments((s) => s.slice(0, index + 1)),
		openDirectory: (entry: FileEntry) => setSegments((s) => [...s, entry.name]),
		applyPathInput: (input: string) => setSegments(pathSegments(input)),
		openFile: (entry: FileEntry) => nav.openFileDetail(environmentID, volumeName, entry),
		openWorkspace: () => nav.openWorkspace(environmentID, volumeName)
	};
}

export type VolumeBrowserModel = ReturnType<typeof useVolumeBrowser>;
