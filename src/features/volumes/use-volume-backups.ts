import { File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { hasPermission, usePermission } from '@/core/auth/permissions';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { ServerCapabilities } from '@/sdk/client/ServerCapabilities';
import type { EnvironmentID } from '@/sdk/client/environment';
import { CancellationError, isArcaneError } from '@/sdk/errors/ArcaneError';
import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import type { BackupEntry, DiscoverVolumeBackupsResponse } from '@/sdk/models/volume/Backup';
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

async function loadBackupsPage(params: {
	client: ArcaneClient;
	scope: BackupRequestScope;
	isUnmounted: () => boolean;
	environmentID: EnvironmentID;
	volumeName: string;
	more: boolean;
	backupsRef: { current: BackupEntry[] };
	setBackups: (value: BackupEntry[]) => void;
	setWarnings: (value: string[]) => void;
	setHasMore: (value: boolean) => void;
	setSupportsPolicies: (value: boolean) => void;
	setDestinations: (value: S3Destination[]) => void;
	resetDestination: () => void;
	setLoadMoreError: (value: string) => void;
	setErrorMessage: (value: string) => void;
}) {
	const { client, scope, isUnmounted, environmentID, volumeName, more, backupsRef } = params;
	try {
		const page = await client.volumes.listBackupsWithWarnings({
			envID: environmentID,
			name: volumeName,
			query: { start: more ? backupsRef.current.length : 0, limit: 50 }
		});
		scope.check(isUnmounted);
		const next = more ? [...backupsRef.current, ...page.data] : page.data;
		backupsRef.current = next;
		params.setBackups(next);
		params.setWarnings(page.warnings ?? []);
		params.setHasMore(next.length < page.pagination.totalItems);
		if (!more) {
			let supports = false;
			try {
				await client.volumes.backupPolicies({ envID: environmentID, name: volumeName });
				scope.check(isUnmounted);
				supports = true;
				params.setSupportsPolicies(true);
			} catch (error) {
				if (isArcaneError(error, 'notFound')) {
					params.setSupportsPolicies(false);
					params.resetDestination();
				} else if (isArcaneError(error, 'forbidden')) {
					params.setSupportsPolicies(false);
				} else {
					throw error;
				}
			}
			if (supports && hasPermission('s3-destinations:list', null)) {
				const options = await client.s3Destinations.options();
				scope.check(isUnmounted);
				params.setDestinations(options);
			}
		}
	} catch (error) {
		if (!isCancellation(error)) {
			if (more) params.setLoadMoreError(friendlyErrorMessage(error));
			else params.setErrorMessage(friendlyErrorMessage(error));
		}
	}
}

function discoveredBackupsToast(result: DiscoverVolumeBackupsResponse) {
	if (result.errors && result.errors.length > 0) {
		return Toasts.error(`Discovered ${result.count} with ${result.errors.length} errors`);
	}
	return Toasts.success(`Discovered ${result.count} backups`);
}

export function useVolumeBackups(environmentID: EnvironmentID, volumeName: string) {
	const nav = useVolumeNavigation();
	useBackupSessionScope();
	const unmounted = useUnmounted();
	const generation = useClientManager((s) => s.clientGeneration);

	const [backups, setBackups] = useState<BackupEntry[]>([]);
	const backupsRef = useRef(backups);
	const [warnings, setWarnings] = useState<string[]>([]);
	const [busy, setBusyState] = useState(false);
	const busyRef = useRef(false);
	const setBusy = useCallback((value: boolean) => {
		busyRef.current = value;
		setBusyState(value);
	}, []);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [loadMoreError, setLoadMoreError] = useState<string>();
	const [hasMore, setHasMore] = useState(false);
	const [downloadFile, setDownloadFile] = useState<File>();
	const downloadRef = useRef<File | undefined>(undefined);
	useLayoutEffect(() => {
		backupsRef.current = backups;
		downloadRef.current = downloadFile;
	});
	const [discoverID, setDiscoverID] = useState('');
	const [isDiscovering, setIsDiscovering] = useState(false);

	const canBackup = usePermission('volumes:backup', environmentID);
	const canUpload = usePermission('volumes:upload', environmentID);

	const createActionRef = useRef<() => Promise<boolean>>(async () => false);
	const [createState] = useState<BackupCreateStore>(() =>
		createStore<BackupCreateState>((set) => ({
			destination: 'local',
			s3ID: '',
			supportsPolicies: false,
			destinations: [],
			setDestination: (destination) => set({ destination }),
			setS3ID: (s3ID) => set({ s3ID }),
			create: () => createActionRef.current()
		}))
	);
	const [supportsPolicies, setSupportsPoliciesState] = useState(false);
	const [destinations, setDestinationsState] = useState<S3Destination[]>([]);
	const setSupportsPolicies = useCallback(
		(value: boolean) => {
			setSupportsPoliciesState(value);
			createState.setState({ supportsPolicies: value });
		},
		[createState]
	);
	const setDestinations = useCallback(
		(value: S3Destination[]) => {
			setDestinationsState(value);
			createState.setState({ destinations: value });
		},
		[createState]
	);

	const load = useCallback(
		async (more = false) => {
			if (busyRef.current) return;
			setLoadMoreError(undefined);
			const scope = new BackupRequestScope();
			const client = useClientManager.getState().client;
			if (!client) return;
			setBusy(true);
			setErrorMessage(undefined);
			await withCleanup(
				() =>
					loadBackupsPage({
						client,
						scope,
						isUnmounted: () => unmounted.current,
						environmentID,
						volumeName,
						more,
						backupsRef,
						setBackups,
						setWarnings,
						setHasMore,
						setSupportsPolicies,
						setDestinations,
						resetDestination: () => createState.setState({ destination: 'local' }),
						setLoadMoreError,
						setErrorMessage
					}),
				() => {
					if (!unmounted.current) setBusy(false);
				}
			);
		},
		[
			environmentID,
			volumeName,
			unmounted,
			setBusy,
			setSupportsPolicies,
			setDestinations,
			createState
		]
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

	useLayoutEffect(() => {
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
	});

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
		await withCleanup(
			async () => {
				try {
					const result = await client.volumes.discoverBackups({
						envID: environmentID,
						s3DestinationId: discoverID
					});
					showToast(discoveredBackupsToast(result));
					await load();
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setIsDiscovering(false)
		);
	};

	const download = async (backup: BackupEntry) => {
		const scope = new BackupRequestScope();
		const client = useClientManager.getState().client;
		if (!client) return;
		setBusy(true);
		const target = new File(Paths.cache, `${uuidString()}.tar.gz`);
		await withCleanup(
			async () => {
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
				}
			},
			() => {
				if (!unmounted.current) setBusy(false);
			}
		);
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
