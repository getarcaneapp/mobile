import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { withCleanup } from '@/core/with-cleanup';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { CreateS3Destination } from '@/sdk/models/backup/CreateS3Destination';
import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { useBackupNavigation } from './backup-routes';
import {
	backupRequestScope,
	useAliveRef,
	useBackupSessionScope,
	useEmitOnDismiss,
	useGlobalPermissions,
	useSheetDismissListener
} from './backup-scope';
import { useDismiss } from './use-backup-forms';

type S3DestinationsOutcome =
	| { kind: 'stale' }
	| { kind: 'page'; entries: S3Destination[]; hasMore: boolean }
	| { kind: 'error'; message: string };

async function fetchS3DestinationsPage(
	client: ArcaneClient,
	scope: { check(): void },
	isCurrent: () => boolean,
	more: boolean,
	current: S3Destination[]
): Promise<S3DestinationsOutcome> {
	try {
		const page = await client.s3Destinations.list({
			query: { start: more ? current.length : 0, limit: 50 }
		});
		scope.check();
		if (!isCurrent()) return { kind: 'stale' };
		const next = more ? [...current, ...page.data] : page.data;
		return { kind: 'page', entries: next, hasMore: next.length < page.pagination.totalItems };
	} catch (error) {
		if (isCancellation(error) || !isCurrent()) return { kind: 'stale' };
		return { kind: 'error', message: friendlyErrorMessage(error) };
	}
}

export function useS3Destinations() {
	const client = useClientManager((s) => s.client);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const permissions = useGlobalPermissions();
	const nav = useBackupNavigation();
	const alive = useAliveRef();
	useBackupSessionScope();

	const [destinations, setDestinations] = useState<S3Destination[]>([]);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [loadMoreError, setLoadMoreError] = useState<string>();
	const [deleteTarget, setDeleteTarget] = useState<S3Destination>();
	const [hasMore, setHasMore] = useState(false);
	const [busy, setBusy] = useState(false);

	const listIdentity = `${clientGeneration}`;
	const identityRef = useRef(listIdentity);
	const loadedIdentity = useRef('');
	const loadingIdentity = useRef<string | undefined>(undefined);
	const requestID = useRef(0);
	const destinationsRef = useRef(destinations);
	useLayoutEffect(() => {
		identityRef.current = listIdentity;
		destinationsRef.current = destinations;
	});

	const load = useCallback(
		async (more = false) => {
			const scope = backupRequestScope(() => alive.current);
			if (!client) return;
			const key = identityRef.current;
			if (loadingIdentity.current === key) return;
			const request = ++requestID.current;
			loadingIdentity.current = key;
			let current = destinationsRef.current;
			if (loadedIdentity.current !== key) {
				current = [];
				setDestinations([]);
				setHasMore(false);
				loadedIdentity.current = key;
			}
			setBusy(true);
			setErrorMessage(undefined);
			setLoadMoreError(undefined);
			const isCurrent = () => key === identityRef.current && requestID.current === request;
			await withCleanup(
				async () => {
					const outcome = await fetchS3DestinationsPage(client, scope, isCurrent, more, current);
					switch (outcome.kind) {
						case 'page':
							destinationsRef.current = outcome.entries;
							setDestinations(outcome.entries);
							setHasMore(outcome.hasMore);
							break;
						case 'error':
							if (more) setLoadMoreError(outcome.message);
							else setErrorMessage(outcome.message);
							break;
						case 'stale':
							break;
					}
				},
				() => {
					if (requestID.current === request) {
						setBusy(false);
						loadingIdentity.current = undefined;
					}
				}
			);
		},
		[alive, client]
	);

	useEffect(() => {
		void load();
	}, [listIdentity, load]);

	useSheetDismissListener('s3', () => void load());

	const remove = async (destination: S3Destination) => {
		const scope = backupRequestScope(() => alive.current);
		if (!client) return;
		try {
			const usage = await client.s3Destinations.usage({ id: destination.id });
			scope.check();
			if (usage.inUse) {
				showToast(Toasts.error('This destination is still in use'));
				return;
			}
			await client.s3Destinations.delete({ id: destination.id });
			scope.check();
			await load();
			showToast(Toasts.success('S3 destination deleted'));
		} catch (error) {
			if (!isCancellation(error)) showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	return {
		destinations,
		errorMessage,
		loadMoreError,
		hasMore,
		busy,
		canCreate: permissions.has('s3-destinations:create'),
		canDelete: permissions.has('s3-destinations:delete'),
		deleteTarget,
		setDeleteTarget,
		remove: (destination: S3Destination) => void remove(destination),
		load,
		refresh: () => load(),
		loadMore: () => void load(true),
		openEditor: nav.openS3Editor,
		openCreate: nav.openS3Create
	};
}

export type S3DestinationsModel = ReturnType<typeof useS3Destinations>;

export function useS3DestinationEditor(destination: S3Destination | undefined) {
	const client = useClientManager((s) => s.client);
	const permissions = useGlobalPermissions();
	const dismiss = useDismiss();
	const alive = useAliveRef();
	useBackupSessionScope();
	useEmitOnDismiss('s3', destination === undefined);

	const [name, setName] = useState(destination?.name ?? '');
	const [endpoint, setEndpoint] = useState(destination?.endpoint ?? '');
	const [bucket, setBucket] = useState(destination?.bucket ?? '');
	const [region, setRegion] = useState(destination?.region ?? 'us-east-1');
	const [accessKeyID, setAccessKeyID] = useState(destination?.accessKeyId ?? '');
	const [secret, setSecret] = useState('');
	const [prefix, setPrefix] = useState(destination?.prefix ?? '');
	const [useSSL, setUseSSL] = useState(destination?.useSsl ?? true);
	const [forcePathStyle, setForcePathStyle] = useState(destination?.forcePathStyle ?? true);
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const canSave = permissions.has(
		destination === undefined ? 's3-destinations:create' : 's3-destinations:update'
	);
	const valid =
		name !== '' &&
		bucket !== '' &&
		region !== '' &&
		accessKeyID !== '' &&
		(destination !== undefined || secret !== '');
	const request: CreateS3Destination = {
		name,
		endpoint,
		bucket,
		region,
		accessKeyId: accessKeyID,
		secretAccessKey: secret,
		prefix,
		useSsl: useSSL,
		forcePathStyle
	};

	const test = async () => {
		const scope = backupRequestScope(() => alive.current);
		if (!client) return;
		setBusy(true);
		await withCleanup(
			async () => {
				try {
					if (destination)
						await client.s3Destinations.test({ id: destination.id, configuration: request });
					else await client.s3Destinations.testConfiguration({ configuration: request });
					scope.check();
					showToast(Toasts.success('S3 connection test succeeded'));
				} catch (error) {
					if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => {
				if (alive.current) setBusy(false);
			}
		);
	};

	const save = async () => {
		const scope = backupRequestScope(() => alive.current);
		if (!client || !canSave) return;
		setBusy(true);
		await withCleanup(
			async () => {
				try {
					if (destination) await client.s3Destinations.update({ id: destination.id, request });
					else await client.s3Destinations.create({ request });
					setSecret('');
					scope.check();
					showToast(Toasts.success('S3 destination saved'));
					dismiss();
				} catch (error) {
					if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => {
				if (alive.current) setBusy(false);
			}
		);
	};

	return {
		isNew: destination === undefined,
		title: destination?.name ?? 'S3 Destination',
		name,
		setName,
		endpoint,
		setEndpoint,
		bucket,
		setBucket,
		region,
		setRegion,
		accessKeyID,
		setAccessKeyID,
		secret,
		setSecret,
		prefix,
		setPrefix,
		useSSL,
		setUseSSL,
		forcePathStyle,
		setForcePathStyle,
		busy,
		errorMessage,
		canSave,
		canTest: permissions.has('s3-destinations:test'),
		valid,
		saveTitle: destination === undefined ? 'Create' : 'Save',
		test: () => void test(),
		save: () => void save(),
		cancel: dismiss
	};
}

export type S3DestinationEditorModel = ReturnType<typeof useS3DestinationEditor>;
