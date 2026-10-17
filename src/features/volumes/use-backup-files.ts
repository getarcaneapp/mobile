/**
 * Model behind the volume flavour of `BackupFilesView`
 * (Views/Settings/Backups/BackupFilesView.swift, `volumeName != nil`):
 * paginated browse with a legacy flat-list fallback, selection, and partial
 * restore.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import type { BackupFileEntry } from '@/sdk/models/backup/BackupFileEntry';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { containsCaseInsensitive, uuidString } from './volume-model';
import {
	BackupRequestScope,
	confirmationDialog,
	useBackupSessionScope,
	useUnmounted
} from './volume-support';

/** `NSString.lastPathComponent`. */
export function lastPathComponent(path: string) {
	const trimmed = path.replace(/\/+$/, '');
	if (trimmed === '') return path.startsWith('/') ? '/' : '';
	return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

/** `NSString.deletingLastPathComponent`. */
export function deletingLastPathComponent(path: string) {
	const trimmed = path.replace(/\/+$/, '');
	const index = trimmed.lastIndexOf('/');
	if (index < 0) return '';
	if (index === 0) return '/';
	return trimmed.slice(0, index);
}

export function useBackupFiles({
	backupID,
	environmentID,
	volumeName,
	canRestore
}: {
	backupID: string;
	environmentID: EnvironmentID;
	volumeName: string;
	canRestore: boolean;
}) {
	useBackupSessionScope();
	const unmounted = useUnmounted();
	const generation = useClientManager((s) => s.clientGeneration);
	const [path, setPath] = useState('');
	const [search, setSearch] = useState('');
	const [entries, setEntries] = useState<BackupFileEntry[]>([]);
	const entriesRef = useRef(entries);
	const [selected, setSelected] = useState<string[]>([]);
	const [selectAll, setSelectAll] = useState(false);
	const [legacyBrowser, setLegacyBrowser] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [loadMoreError, setLoadMoreError] = useState<string>();

	const listIdentity = `${generation}:${path}:${search}`;
	const latest = useRef({ listIdentity, path, search });
	latest.current = { listIdentity, path, search };
	const loadedIdentity = useRef('');
	const loadingIdentity = useRef<string | undefined>(undefined);
	const requestID = useRef('');

	const updateEntries = (next: BackupFileEntry[]) => {
		entriesRef.current = next;
		setEntries(next);
	};

	const load = useCallback(
		async (more = false) => {
			const scope = new BackupRequestScope();
			const client = useClientManager.getState().client;
			if (!client) return;
			const { listIdentity: key, path: requestPath, search: requestSearch } = latest.current;
			if (loadingIdentity.current === key) return;
			const request = uuidString();
			requestID.current = request;
			loadingIdentity.current = key;
			if (loadedIdentity.current !== key) {
				updateEntries([]);
				setHasMore(false);
				loadedIdentity.current = key;
			}
			setBusy(true);
			setErrorMessage(undefined);
			setLoadMoreError(undefined);
			if (!more) {
				setSelected([]);
				setSelectAll(false);
			}
			const isCurrent = () => key === latest.current.listIdentity && requestID.current === request;
			try {
				let page;
				try {
					page = await client.volumes.browseBackupFiles({
						envID: environmentID,
						backupID,
						path: requestPath,
						search: requestSearch,
						start: more ? entriesRef.current.length : 0,
						limit: 50
					});
				} catch (error) {
					if (!isArcaneError(error, 'notFound')) throw error;
					const paths = await client.volumes.listBackupFiles({ envID: environmentID, backupID });
					scope.check(() => unmounted.current);
					if (!isCurrent()) return;
					updateEntries(
						paths
							.filter((p) => requestSearch === '' || containsCaseInsensitive(p, requestSearch))
							.map((p) => ({ path: p, name: lastPathComponent(p), isDirectory: false }))
					);
					setLegacyBrowser(true);
					setSelectAll(false);
					setHasMore(false);
					return;
				}
				scope.check(() => unmounted.current);
				if (!isCurrent()) return;
				const next = [...(more ? entriesRef.current : []), ...page.data];
				updateEntries(next);
				setHasMore(next.length < page.pagination.totalItems);
			} catch (error) {
				if (isCancellation(error) || !isCurrent()) return;
				if (more) setLoadMoreError(friendlyErrorMessage(error));
				else setErrorMessage(friendlyErrorMessage(error));
			} finally {
				if (requestID.current === request && !unmounted.current) {
					setBusy(false);
					loadingIdentity.current = undefined;
				}
			}
		},
		[environmentID, backupID, unmounted]
	);

	useEffect(() => {
		void load();
	}, [listIdentity, load]);

	const restore = async () => {
		const scope = new BackupRequestScope();
		const client = useClientManager.getState().client;
		if (!client) return;
		setBusy(true);
		try {
			await client.volumes.restoreBackupFiles({
				envID: environmentID,
				name: volumeName,
				backupID,
				selection: { paths: [...selected], selectAll, search: search === '' ? undefined : search }
			});
			scope.check(() => unmounted.current);
			showToast(Toasts.info('Restore request accepted'));
		} catch (error) {
			if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (!unmounted.current) setBusy(false);
		}
	};

	return {
		path,
		folderTitle: path === '' ? '/' : path,
		search,
		setSearch,
		entries,
		selected,
		selectAll,
		setSelectAll,
		legacyBrowser,
		hasMore,
		busy,
		errorMessage,
		loadMoreError,
		canRestore,
		showsToggle: canRestore && !legacyBrowser,
		showsSelection: canRestore && !selectAll,
		canSubmitRestore: !(busy || (!selectAll && selected.length === 0)),
		retry: () => void load(),
		loadMore: () => void load(true),
		goToParent: () => setPath((p) => deletingLastPathComponent(p)),
		openDirectory: (entry: BackupFileEntry) => setPath(entry.path),
		toggleSelected: (entry: BackupFileEntry) =>
			setSelected((current) =>
				current.includes(entry.path)
					? current.filter((p) => p !== entry.path)
					: [...current, entry.path]
			),
		requestRestore: () =>
			confirmationDialog({
				title: `Restore files to ${volumeName}?`,
				message: 'Existing files at the selected paths may be overwritten.',
				actionTitle: `Restore ${selectAll ? 'all matching files' : `${selected.length} selected paths`}`,
				onConfirm: () => void restore()
			})
	};
}

export type BackupFilesModel = ReturnType<typeof useBackupFiles>;
