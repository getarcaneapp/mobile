import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import type { BackupFileEntry } from '@/sdk/models/backup/BackupFileEntry';
import type { PaginatedResponse } from '@/sdk/pagination/PaginatedResponse';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads } from '../shared/settings-routes';
import type { BackupFilesTarget } from './backup-routes';
import { backupRequestScope, useAliveRef, useBackupSessionScope } from './backup-scope';

function lastPathComponent(path: string): string {
	const trimmed = path.replace(/\/+$/, '');
	if (trimmed === '') return path === '' ? '' : '/';
	return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

function deletingLastPathComponent(path: string): string {
	const trimmed = path.replace(/\/+$/, '');
	const index = trimmed.lastIndexOf('/');
	if (index < 0) return '';
	if (index === 0) return '/';
	return trimmed.slice(0, index);
}

export function useBackupFiles(target: BackupFilesTarget & { keyToken?: string }) {
	const { backupID, environmentID, volumeName, canRestore } = target;
	const [recoveryKey] = useState(target.recoveryKey ?? '');
	const client = useClientManager((s) => s.client);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const alive = useAliveRef();
	useBackupSessionScope();

	const keyToken = target.keyToken;
	useEffect(() => () => settingsPayloads.delete(keyToken), [keyToken]);

	const [path, setPath] = useState('');
	const [search, setSearch] = useState('');
	const [entries, setEntries] = useState<BackupFileEntry[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [selectAll, setSelectAll] = useState(false);
	const [legacyBrowser, setLegacyBrowser] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [loadMoreError, setLoadMoreError] = useState<string>();
	const [confirm, setConfirm] = useState(false);

	const listIdentity = `${clientGeneration}:${path}:${search}`;
	const identityRef = useRef(listIdentity);
	identityRef.current = listIdentity;
	const queryRef = useRef({ path, search });
	queryRef.current = { path, search };
	const loadedIdentity = useRef('');
	const loadingIdentity = useRef<string | undefined>(undefined);
	const requestID = useRef(0);
	const entriesRef = useRef(entries);
	entriesRef.current = entries;

	const load = useCallback(
		async (more = false) => {
			const scope = backupRequestScope(() => alive.current);
			if (!client) return;
			const key = identityRef.current;
			const { path: currentPath, search: currentSearch } = queryRef.current;
			if (loadingIdentity.current === key) return;
			const request = ++requestID.current;
			loadingIdentity.current = key;
			let current = entriesRef.current;
			if (loadedIdentity.current !== key) {
				current = [];
				setEntries([]);
				setHasMore(false);
				loadedIdentity.current = key;
			}
			setBusy(true);
			setErrorMessage(undefined);
			setLoadMoreError(undefined);
			if (!more) {
				setSelected(new Set());
				setSelectAll(false);
			}
			const isCurrent = () => key === identityRef.current && requestID.current === request;
			try {
				let page: PaginatedResponse<BackupFileEntry>;
				const start = more ? current.length : 0;
				if (volumeName !== undefined) {
					try {
						page = await client.volumes.browseBackupFiles({
							envID: environmentID,
							backupID,
							path: currentPath,
							search: currentSearch,
							start,
							limit: 50
						});
					} catch (error) {
						if (!isArcaneError(error, 'notFound')) throw error;
						const paths = await client.volumes.listBackupFiles({ envID: environmentID, backupID });
						scope.check();
						if (!isCurrent()) return;
						const needle = currentSearch.toLocaleLowerCase();
						const next = paths
							.filter((file) => currentSearch === '' || file.toLocaleLowerCase().includes(needle))
							.map((file) => ({ path: file, name: lastPathComponent(file), isDirectory: false }));
						entriesRef.current = next;
						setEntries(next);
						setLegacyBrowser(true);
						setSelectAll(false);
						setHasMore(false);
						return;
					}
				} else {
					page = await client.systemBackups.browseFiles({
						id: backupID,
						recoveryKey,
						path: currentPath,
						search: currentSearch,
						start,
						limit: 50
					});
				}
				scope.check();
				if (!isCurrent()) return;
				const next = more ? [...current, ...page.data] : page.data;
				entriesRef.current = next;
				setEntries(next);
				setHasMore(next.length < page.pagination.totalItems);
			} catch (error) {
				if (isCancellation(error) || !isCurrent()) return;
				if (more) setLoadMoreError(friendlyErrorMessage(error));
				else setErrorMessage(friendlyErrorMessage(error));
			} finally {
				if (requestID.current === request) {
					setBusy(false);
					loadingIdentity.current = undefined;
				}
			}
		},
		[alive, backupID, client, environmentID, recoveryKey, volumeName]
	);

	useEffect(() => {
		void load();
	}, [listIdentity, load]);

	const toggleSelected = (entryPath: string) =>
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(entryPath)) next.delete(entryPath);
			else next.add(entryPath);
			return next;
		});

	const restore = async () => {
		const scope = backupRequestScope(() => alive.current);
		if (!client) return;
		setBusy(true);
		try {
			const paths = [...selected];
			const searchValue = search === '' ? undefined : search;
			if (volumeName !== undefined) {
				await client.volumes.restoreBackupFiles({
					envID: environmentID,
					name: volumeName,
					backupID,
					selection: { paths, selectAll, search: searchValue }
				});
			} else {
				await client.systemBackups.restoreFiles({
					id: backupID,
					request: { paths, selectAll, search: searchValue, recoveryKey }
				});
			}
			scope.check();
			showToast(Toasts.info('Restore request accepted'));
		} catch (error) {
			if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (alive.current) setBusy(false);
		}
	};

	return {
		canRestore,
		path,
		folderTitle: path === '' ? '/' : path,
		openFolder: setPath,
		openParent: () => setPath(deletingLastPathComponent(path)),
		search,
		setSearch,
		entries,
		selected,
		toggleSelected,
		selectAll,
		setSelectAll,
		legacyBrowser,
		hasMore,
		busy,
		errorMessage,
		loadMoreError,
		load,
		loadMore: () => void load(true),
		restoreDisabled: busy || (!selectAll && selected.size === 0),
		confirm,
		setConfirm,
		confirmTitle: `Restore files to ${volumeName ?? 'the server projects directory'}?`,
		confirmAction: `Restore ${selectAll ? 'all matching files' : `${selected.size} selected paths`}`,
		confirmMessage: 'Existing files at the selected paths may be overwritten.',
		restore: () => void restore()
	};
}

export type BackupFilesModel = ReturnType<typeof useBackupFiles>;
