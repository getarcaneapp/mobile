/** Data for `SystemBackupsView` (SystemBackupsView.swift). Shared by both platforms. */
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { formatFileBytes } from '@/core/networking/remote-data-limits';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import type { BackupHistoryEntry } from '@/sdk/models/backup/BackupHistoryEntry';
import { parseArcaneDate } from '@/sdk/models/base/date';
import { useClientManager } from '@/stores/client-manager';

import {
	backupRequestScope,
	useAliveRef,
	useBackupSessionScope,
	useGlobalPermissions,
	useSheetDismissListener
} from './backup-scope';

/** `Text(entry.createdAt, style: .date)` (long date). */
export function backupEntryDate(entry: BackupHistoryEntry): string {
	const date = parseArcaneDate(entry.createdAt);
	return date ? date.toLocaleDateString(undefined, { dateStyle: 'long' }) : entry.createdAt;
}

/** `"\(status) · \(destination) · \(size)"`. */
export function backupEntrySummary(entry: BackupHistoryEntry): string {
	return `${entry.status} · ${entry.destination} · ${formatFileBytes(entry.size)}`;
}

export function useSystemBackups() {
	const client = useClientManager((s) => s.client);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const permissions = useGlobalPermissions();
	const canRead = permissions.isAdmin && permissions.has('system-backups:read');
	const canManage = permissions.isAdmin && permissions.has('system-backups:manage');
	const alive = useAliveRef();
	useBackupSessionScope();

	const [entries, setEntries] = useState<BackupHistoryEntry[]>([]);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [loadMoreError, setLoadMoreError] = useState<string>();
	const [busy, setBusy] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [search, setSearch] = useState('');
	const [supported, setSupported] = useState(true);

	const listIdentity = `${clientGeneration}:${search}`;
	const identityRef = useRef(listIdentity);
	identityRef.current = listIdentity;
	const loadedIdentity = useRef('');
	const loadingIdentity = useRef<string | undefined>(undefined);
	const requestID = useRef(0);
	const entriesRef = useRef(entries);
	entriesRef.current = entries;

	const load = useCallback(
		async (more = false) => {
			const scope = backupRequestScope(() => alive.current);
			if (!canRead || !client) return;
			const key = identityRef.current;
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
			const searchText = key.slice(key.indexOf(':') + 1);
			try {
				const page = await client.systemBackups.history({
					query: {
						search: searchText,
						start: more ? current.length : 0,
						limit: 50,
						sortBy: 'createdAt',
						sortOrder: 'desc'
					}
				});
				scope.check();
				if (key !== identityRef.current || requestID.current !== request) return;
				setSupported(true);
				const next = more ? [...current, ...page.data] : page.data;
				entriesRef.current = next;
				setEntries(next);
				setHasMore(next.length < page.pagination.totalItems);
			} catch (error) {
				if (isCancellation(error)) return;
				if (key !== identityRef.current || requestID.current !== request) return;
				if (isArcaneError(error, 'notFound')) {
					setSupported(false);
					setErrorMessage('System backups are not available on this server.');
				} else if (more) {
					setLoadMoreError(friendlyErrorMessage(error));
				} else {
					setErrorMessage(friendlyErrorMessage(error));
				}
			} finally {
				if (requestID.current === request) {
					setBusy(false);
					loadingIdentity.current = undefined;
				}
			}
		},
		[alive, canRead, client]
	);

	// `.task(id: "\(clientGeneration):\(search)")`: load, then poll every 5 s while a run is in progress.
	useEffect(() => {
		void load();
		const timer = setInterval(() => {
			if (entriesRef.current.some((entry) => entry.status === 'running')) void load();
		}, 5_000);
		return () => clearInterval(timer);
	}, [listIdentity, load]);

	useSheetDismissListener('history', () => void load());

	return {
		canRead,
		canManage,
		supported,
		entries,
		errorMessage,
		loadMoreError,
		busy,
		hasMore,
		search,
		setSearch,
		load,
		refresh: () => load(),
		loadMore: () => void load(true)
	};
}

export type SystemBackupsModel = ReturnType<typeof useSystemBackups>;
