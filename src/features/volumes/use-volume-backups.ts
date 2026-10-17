import { File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { ServerCapabilities } from '@/sdk/client/ServerCapabilities';
import type { EnvironmentID } from '@/sdk/client/environment';
import { CancellationError, isArcaneError } from '@/sdk/errors/ArcaneError';
import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import type { BackupEntry } from '@/sdk/models/volume/Backup';
import type { UploadFileSource } from '@/sdk/services/UploadsService';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { uuidString } from './volume-model';
import { routePayloads, useVolumeNavigation } from './volume-routes';
import {
	BackupRequestScope,
	confirmationDialog,
	downloadTo,
	removeItem,
	shareFile,
	useBackupSessionScope,
	useUnmounted
} from './volume-support';
import { pickedFileName } from '@/core/picked-file-name';

export type BackupCreateState = {
	destination: string;
	s3ID: string;
	supportsPolicies: boolean;
	destinations: S3Destination[];
	setDestination: (value: string) => void;
	setS3ID: (value: string) => void;
	create: () => Promise<boolean>;
};

export type BackupCreateStore = StoreApi<BackupCreateState>;

function fileUploadSource(file: File, name: string): UploadFileSource {
	return {
		name,
		size: file.size,
		async read(offset, count) {
			const handle = file.open();
			try {
				handle.offset = offset;
				const out = new Uint8Array(count);
				let filled = 0;
				while (filled < count) {
					const bytes = await handle.readBytes(count - filled);
					if (bytes.byteLength === 0) break;
					out.set(bytes, filled);
					filled += bytes.byteLength;
				}
				return filled === count ? out : out.slice(0, filled);
			} finally {
				handle.close();
			}
		}
	};
}

export function useVolumeBackups(environmentID: EnvironmentID, volumeName: string) {
	const nav = useVolumeNavigation();
	useBackupSessionScope();
	const unmounted = useUnmounted();
	const generation = useClientManager((s) => s.clientGeneration);
	useClientManager((s) => s.accessGeneration);

	const [backups, setBackups] = useState<BackupEntry[]>([]);
	const backupsRef = useRef(backups);
	backupsRef.current = backups;
	const [warnings, setWarnings] = useState<string[]>([]);
	const [busy, setBusyState] = useState(false);
	const busyRef = useRef(false);
	const setBusy = (value: boolean) => {
		busyRef.current = value;
		setBusyState(value);
	};
	const [errorMessage, setErrorMessage] = useState<string>();
	const [loadMoreError, setLoadMoreError] = useState<string>();
	const [hasMore, setHasMore] = useState(false);
	const [downloadFile, setDownloadFile] = useState<File>();
	const downloadRef = useRef<File | undefined>(undefined);
	downloadRef.current = downloadFile;
	const [discoverID, setDiscoverID] = useState('');
	const [isDiscovering, setIsDiscovering] = useState(false);

	const canBackup = hasPermission('volumes:backup', environmentID);
	const canUpload = hasPermission('volumes:upload', environmentID);

	const createStoreRef = useRef<BackupCreateStore | null>(null);
	const createActionRef = useRef<() => Promise<boolean>>(async () => false);
	createStoreRef.current ??= createStore<BackupCreateState>((set) => ({
		destination: 'local',
		s3ID: '',
		supportsPolicies: false,
		destinations: [],
		setDestination: (destination) => set({ destination }),
		setS3ID: (s3ID) => set({ s3ID }),
		create: () => createActionRef.current()
	}));
	const createState = createStoreRef.current;
	const [supportsPolicies, setSupportsPoliciesState] = useState(false);
	const [destinations, setDestinationsState] = useState<S3Destination[]>([]);
	const setSupportsPolicies = (value: boolean) => {
		setSupportsPoliciesState(value);
		createState.setState({ supportsPolicies: value });
	};
	const setDestinations = (value: S3Destination[]) => {
		setDestinationsState(value);
		createState.setState({ destinations: value });
	};

	const load = useCallback(
		async (more = false) => {
			if (busyRef.current) return;
			setLoadMoreError(undefined);
			const scope = new BackupRequestScope();
			const client = useClientManager.getState().client;
			if (!client) return;
			setBusy(true);
			setErrorMessage(undefined);
			try {
				const page = await client.volumes.listBackupsWithWarnings({
					envID: environmentID,
					name: volumeName,
					query: { start: more ? backupsRef.current.length : 0, limit: 50 }
				});
				scope.check(() => unmounted.current);
				const next = more ? [...backupsRef.current, ...page.data] : page.data;
				backupsRef.current = next;
				setBackups(next);
				setWarnings(page.warnings ?? []);
				setHasMore(next.length < page.pagination.totalItems);
				if (!more) {
					let supports = false;
					try {
						await client.volumes.backupPolicies({ envID: environmentID, name: volumeName });
						scope.check(() => unmounted.current);
						supports = true;
						setSupportsPolicies(true);
					} catch (error) {
						if (isArcaneError(error, 'notFound')) {
							setSupportsPolicies(false);
							createState.setState({ destination: 'local' });
						} else if (isArcaneError(error, 'forbidden')) {
							setSupportsPolicies(false);
						} else {
							throw error;
						}
					}
					if (supports && hasPermission('s3-destinations:list', null)) {
						const options = await client.s3Destinations.options();
						scope.check(() => unmounted.current);
						setDestinations(options);
					}
				}
			} catch (error) {
				if (!isCancellation(error)) {
					if (more) setLoadMoreError(friendlyErrorMessage(error));
					else setErrorMessage(friendlyErrorMessage(error));
				}
			} finally {
				if (!unmounted.current) setBusy(false);
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[environmentID, volumeName]
	);

	useEffect(() => {
		let cancelled = false;
		void load();
		const timer = setInterval(() => {
			if (cancelled) return;
			if (backupsRef.current.some((b) => b.status === 'running')) void load();
		}, 5000);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [load, generation]);

	useEffect(() => () => removeItem(downloadRef.current), []);

	const perform = async (operation: () => Promise<void>) => {
		const scope = new BackupRequestScope();
		setBusy(true);
		try {
			await operation();
			scope.check(() => unmounted.current);
			showToast(Toasts.info('Backup operation accepted'));
			await load();
		} catch (error) {
			if (!isCancellation(error)) showToast(Toasts.error(friendlyErrorMessage(error)));
		}
		if (!unmounted.current) setBusy(false);
	};

	createActionRef.current = async () => {
		const client = useClientManager.getState().client;
		if (!client || !hasPermission('volumes:backup', environmentID)) return false;
		const { destination, s3ID } = createState.getState();
		let created = false;
		await perform(async () => {
			await client.volumes.createBackup({
				envID: environmentID,
				name: volumeName,
				request: { destination, s3DestinationId: destination === 'local' ? undefined : s3ID }
			});
			created = true;
		});
		return created;
	};

	const restore = (backup: BackupEntry) => {
		const client = useClientManager.getState().client;
		if (!client || !canBackup) return;
		void perform(async () => {
			await client.volumes.restoreBackup({
				envID: environmentID,
				name: volumeName,
				backupID: backup.id
			});
		});
	};

	const remove = (backup: BackupEntry) => {
		const client = useClientManager.getState().client;
		if (!client || !canBackup) return;
		void perform(async () => {
			await client.volumes.deleteBackup({ envID: environmentID, backupID: backup.id });
		});
	};

	const upload = (backup: BackupEntry, destinationID: string) => {
		const client = useClientManager.getState().client;
		if (!client || !canBackup) return;
		void perform(async () => {
			await client.volumes.uploadBackupToS3({
				envID: environmentID,
				backupID: backup.id,
				s3DestinationID: destinationID
			});
		});
	};

	const discover = async () => {
		const client = useClientManager.getState().client;
		if (!client || !canBackup || discoverID === '') return;
		setIsDiscovering(true);
		try {
			const result = await client.volumes.discoverBackups({
				envID: environmentID,
				s3DestinationId: discoverID
			});
			if (result.errors && result.errors.length > 0) {
				showToast(Toasts.error(`Discovered ${result.count} with ${result.errors.length} errors`));
			} else {
				showToast(Toasts.success(`Discovered ${result.count} backups`));
			}
			await load();
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		} finally {
			setIsDiscovering(false);
		}
	};

	const download = async (backup: BackupEntry) => {
		const scope = new BackupRequestScope();
		const client = useClientManager.getState().client;
		if (!client) return;
		setBusy(true);
		const target = new File(Paths.cache, `${uuidString()}.tar.gz`);
		try {
			const request = await client.volumes.downloadBackupDownloadRequest({
				envID: environmentID,
				backupID: backup.id
			});
			await downloadTo(request, target);
			scope.check(() => unmounted.current);
			removeItem(downloadRef.current);
			setDownloadFile(target);
		} catch (error) {
			removeItem(target);
			if (!isCancellation(error)) showToast(Toasts.error(friendlyErrorMessage(error)));
		} finally {
			if (!unmounted.current) setBusy(false);
		}
	};

	const importBackup = async (file: File) => {
		const scope = new BackupRequestScope();
		const client = useClientManager.getState().client;
		if (!client || !canUpload) return;
		await perform(async () => {
			const startGeneration = useClientManager.getState().clientGeneration;
			const capabilities = useClientManager.getState().serverCapabilities;
			if (capabilities && ServerCapabilities.supportsRoleManagement(capabilities)) {
				const id = await client.uploads.uploadFile({
					envID: environmentID,
					kind: 'volume-backup',
					file: fileUploadSource(file, pickedFileName(file))
				});
				scope.check(() => unmounted.current);
				const state = useClientManager.getState();
				if (
					state.clientGeneration !== startGeneration ||
					!state.acceptsEnvironmentContext(environmentID)
				) {
					throw new CancellationError();
				}
				await client.volumes.uploadAndRestoreBackup({
					envID: environmentID,
					name: volumeName,
					uploadID: id
				});
			} else {
				await client.volumes.uploadAndRestoreBackupFile({
					envID: environmentID,
					name: volumeName,
					fileURL: file.uri
				});
			}
		});
	};

	const pickImport = async () => {
		try {
			const result = await File.pickFileAsync();
			if (result.canceled) return;
			const file = result.result;
			confirmationDialog({
				title: `Import archive and restore to ${volumeName}?`,
				message: 'Choose a tar.gz volume backup. Existing volume contents may be overwritten.',
				actionTitle: 'Import and restore',
				onConfirm: () => void importBackup(file)
			});
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	return {
		environmentID,
		volumeName,
		backups,
		warnings,
		busy,
		errorMessage,
		loadMoreError,
		hasMore,
		canBackup,
		canUpload,
		supportsPolicies,
		destinations,
		downloadFile,
		discoverID,
		setDiscoverID,
		isDiscovering,
		load,
		refresh: () => load(),
		loadMore: () => void load(true),
		isUsable: (backup: BackupEntry) => backup.status === undefined || backup.status === 'succeeded',
		openCreate: () =>
			nav.openBackupCreate(environmentID, volumeName, routePayloads.put(createState)),
		openPolicies: () => nav.openBackupPolicies(environmentID, volumeName),
		openFiles: (backup: BackupEntry) =>
			nav.openBackupFiles(environmentID, volumeName, backup.id, canBackup),
		pickImport: () => void pickImport(),
		discover: () => void discover(),
		download: (backup: BackupEntry) => void download(backup),
		shareDownload: () => {
			if (downloadFile)
				void shareFile(downloadFile).catch((error: unknown) =>
					showToast(Toasts.error(friendlyErrorMessage(error)))
				);
		},
		requestRestore: (backup: BackupEntry) =>
			confirmationDialog({
				title: `Restore backup to ${volumeName}?`,
				message: 'Existing volume contents may be overwritten.',
				actionTitle: 'Restore volume',
				onConfirm: () => restore(backup)
			}),
		requestDelete: (backup: BackupEntry) =>
			confirmationDialog({
				title: 'Delete this backup?',
				actionTitle: 'Delete backup',
				onConfirm: () => remove(backup)
			}),
		upload
	};
}

export type VolumeBackupsModel = ReturnType<typeof useVolumeBackups>;
