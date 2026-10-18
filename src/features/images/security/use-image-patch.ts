import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import type { Activity } from '@/sdk/models/activity/Activity';
import type { ImagePatchRecord, ImagePatchTarget } from '@/sdk/models/image/ImageOperations';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { useClientManager } from '@/stores/client-manager';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { showToast, Toasts } from '@/ui/toast';

import { useActivityNavigation } from '@/features/activities/activity-routes';

import { useSecurityNavigation } from './security-routes';

const targetsPageSize = 30;

const localizedDescription = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

const sleep = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener('abort', () => {
			clearTimeout(timer);
			reject(new Error('Aborted'));
		});
	});

type PatchTargetsLive = {
	scope: string;
	generation: number;
	loading: boolean;
	targets: ImagePatchTarget[];
	search: string;
};

async function loadPatchTargets({
	client,
	live,
	environmentID,
	reset,
	setLoading,
	setError,
	setLoadMoreError,
	setTargets,
	setHasMore
}: {
	client: ArcaneClient;
	live: PatchTargetsLive;
	environmentID: EnvironmentID;
	reset: boolean;
	setLoading: (loading: boolean) => void;
	setError: (error: string | undefined) => void;
	setLoadMoreError: (error: string | undefined) => void;
	setTargets: (targets: ImagePatchTarget[]) => void;
	setHasMore: (hasMore: boolean) => void;
}) {
	if (live.loading && !reset) return;
	const generation = ++live.generation;
	const expected = live.scope;
	const query = live.search;
	live.loading = true;
	setLoading(true);
	setError(undefined);
	setLoadMoreError(undefined);
	try {
		const result = await client.images.patchTargets({
			envID: environmentID,
			query: {
				search: query === '' ? undefined : query,
				start: reset ? 0 : live.targets.length,
				limit: targetsPageSize
			}
		});
		if (expected !== live.scope || generation !== live.generation) return;
		const next = reset ? result.data : [...live.targets, ...result.data];
		live.targets = next;
		setTargets(next);
		setHasMore(result.data.length === targetsPageSize);
	} catch (caught) {
		if (isCancellation(caught)) return;
		if (expected !== live.scope) return;
		if (isArcaneError(caught, 'notFound'))
			setError('Image patching is not available on this server.');
		else if (reset) setError(friendlyErrorMessage(caught));
		else setLoadMoreError(friendlyErrorMessage(caught));
	} finally {
		if (expected === live.scope && generation === live.generation) {
			live.loading = false;
			setLoading(false);
		}
	}
}

async function checkPatchAvailability({
	client,
	signal,
	environmentID,
	setAvailable,
	setAvailabilityError
}: {
	client: ArcaneClient;
	signal: AbortSignal;
	environmentID: EnvironmentID;
	setAvailable: (available: boolean) => void;
	setAvailabilityError: (error: string | undefined) => void;
}) {
	try {
		await client
			.withSignal(signal)
			.images.patchTargets({ envID: environmentID, query: { limit: 1 } });
		if (signal.aborted) return;
		setAvailable(true);
	} catch (error) {
		if (signal.aborted || isCancellation(error)) return;
		if (isArcaneError(error, 'notFound'))
			setAvailabilityError('Image patching is not available on this server.');
		else setAvailabilityError(localizedDescription(error));
	}
}

async function pollPatchStatus({
	client,
	signal,
	current,
	environmentID,
	setActivity,
	setRecord
}: {
	client: ArcaneClient;
	signal: AbortSignal;
	current: ImagePatchRecord;
	environmentID: EnvironmentID;
	setActivity: (activity: Activity) => void;
	setRecord: (record: ImagePatchRecord) => void;
}) {
	const scoped = client.withSignal(signal);
	try {
		while (!signal.aborted) {
			if (current.activityId && hasPermission('activities:read', environmentID)) {
				const detail = await scoped.activities.detail({
					envID: environmentID,
					activityID: current.activityId
				});
				if (signal.aborted) return;
				setActivity(detail.activity);
			}
			let updated: ImagePatchRecord | undefined;
			if (hasPermission('images:list', environmentID)) {
				const page = await scoped.images.listPatches({
					envID: environmentID,
					query: { search: current.originalRef, limit: 100 }
				});
				updated = page.data.find((patch) => patch.id === current.id);
			} else {
				const page = await scoped.images.patchTargets({
					envID: environmentID,
					query: { search: current.originalRef, limit: 100 }
				});
				updated = page.data
					.flatMap((target) => (target.lastPatch ? [target.lastPatch] : []))
					.find((patch) => patch.id === current.id);
			}
			if (signal.aborted) return;
			if (updated) {
				setRecord(updated);
				if (updated.status !== 'patching') {
					if (updated.status === 'completed')
						useResourceMutationStore.getState().markChanged('images', environmentID);
					return;
				}
			}
			await sleep(3000, signal);
		}
	} catch (error) {
		if (signal.aborted || isCancellation(error)) return;
		showToast(Toasts.error(`Status refresh failed: ${localizedDescription(error)}`));
	}
}

async function submitPatch({
	client,
	signal,
	environmentID,
	imageID,
	options,
	isCurrent,
	setRecord
}: {
	client: ArcaneClient;
	signal: AbortSignal;
	environmentID: EnvironmentID;
	imageID: string;
	options: {
		suffix: string;
		patchedTag: string;
		timeoutSeconds: number | undefined;
		scanID: string;
		ignoreErrors: boolean;
	};
	isCurrent: () => boolean;
	setRecord: (record: ImagePatchRecord) => void;
}) {
	try {
		const result = await client.withSignal(signal).images.patch({
			envID: environmentID,
			imageID,
			options: {
				suffix: options.suffix === '' ? undefined : options.suffix,
				patchedTag: options.patchedTag === '' ? undefined : options.patchedTag,
				timeoutSeconds: options.timeoutSeconds,
				scanId: options.scanID === '' ? undefined : options.scanID,
				ignoreErrors: options.ignoreErrors
			}
		});
		if (signal.aborted || !isCurrent()) return;
		setRecord(result);
		showToast(Toasts.info('Image patch started'));
	} catch (error) {
		if (signal.aborted || isCancellation(error)) return;
		showToast(Toasts.error(localizedDescription(error)));
	}
}

export function useImagePatchTargets(environmentID: EnvironmentID) {
	const nav = useSecurityNavigation();
	const serverURL = useClientManager((s) => s.serverURL);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const [targets, setTargets] = useState<ImagePatchTarget[]>([]);
	const [search, setSearch] = useState('');
	const [error, setError] = useState<string>();
	const [loadMoreError, setLoadMoreError] = useState<string>();
	const [loading, setLoading] = useState(false);
	const [hasMore, setHasMore] = useState(false);

	const scope = `${serverURL}|${clientGeneration}|${environmentID}|${search}`;
	const live = useRef({
		scope,
		generation: 0,
		loading: false,
		targets: [] as ImagePatchTarget[],
		search
	});
	useLayoutEffect(() => {
		live.current.scope = scope;
		live.current.search = search;
	});

	const load = async (reset: boolean) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		await loadPatchTargets({
			client,
			live: live.current,
			environmentID,
			reset,
			setLoading,
			setError,
			setLoadMoreError,
			setTargets,
			setHasMore
		});
	};

	const loadForScope = useEffectEvent(() => () => void load(true));

	useEffect(() => {
		const run = loadForScope();
		const timer = setTimeout(run, 250);
		return () => clearTimeout(timer);
	}, [scope]);

	return {
		targets,
		search,
		setSearch,
		error,
		loadMoreError,
		loading,
		hasMore,
		refresh: () => load(true),
		loadMore: () => void load(false),
		openPatch: (target: ImagePatchTarget) =>
			nav.openPatch(environmentID, target.imageId, target.imageRef, target.localOnly === true)
	};
}

export function useImagePatch({
	environmentID,
	imageID,
	imageName,
	localOnly
}: {
	environmentID: EnvironmentID;
	imageID: string;
	imageName: string;
	localOnly: boolean;
}) {
	const activityNav = useActivityNavigation();
	const serverURL = useClientManager((s) => s.serverURL);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	useClientManager((s) => s.accessGeneration);

	const [suffix, setSuffix] = useState('');
	const [patchedTag, setPatchedTag] = useState('');
	const [scanID, setScanID] = useState('');
	const [timeout, setTimeoutText] = useState('');
	const [ignoreErrors, setIgnoreErrors] = useState(false);
	const [record, setRecord] = useState<ImagePatchRecord>();
	const [activity, setActivity] = useState<Activity>();
	const [submitting, setSubmitting] = useState(false);
	const [available, setAvailable] = useState(false);
	const [availabilityError, setAvailabilityError] = useState<string>();
	const [refreshToken, setRefreshToken] = useState(0);

	const scope = `${serverURL}|${clientGeneration}|${environmentID}|${imageID}`;
	const live = useRef({ scope, patch: undefined as AbortController | undefined });
	useLayoutEffect(() => {
		live.current.scope = scope;
	});

	const hasPatchPermission = useClientManager(() => hasPermission('images:patch', environmentID));
	const canPatch = available && !localOnly && hasPatchPermission;

	const cancelPatch = () => {
		live.current.patch?.abort();
		live.current.patch = undefined;
	};

	const watched = useRef({ clientGeneration, activeEnvironmentID });
	useEffect(() => {
		if (
			watched.current.clientGeneration === clientGeneration &&
			watched.current.activeEnvironmentID === activeEnvironmentID
		)
			return;
		watched.current = { clientGeneration, activeEnvironmentID };
		cancelPatch();
		setRecord(undefined);
		setActivity(undefined);
	}, [clientGeneration, activeEnvironmentID]);

	useEffect(() => () => cancelPatch(), []);

	useEffect(() => {
		const controller = new AbortController();
		setAvailable(false);
		setRecord(undefined);
		setActivity(undefined);
		setAvailabilityError(undefined);
		const client = useClientManager.getState().client;
		if (!client) return;
		void checkPatchAvailability({
			client,
			signal: controller.signal,
			environmentID,
			setAvailable,
			setAvailabilityError
		});
		return () => controller.abort();
	}, [scope, environmentID]);

	const recordID = record?.id ?? '';
	const recordRef = useRef(record);
	useLayoutEffect(() => {
		recordRef.current = record;
	});
	useEffect(() => {
		const current = recordRef.current;
		const client = useClientManager.getState().client;
		if (!current || !client) return;
		const controller = new AbortController();
		const signal = controller.signal;
		void pollPatchStatus({ client, signal, current, environmentID, setActivity, setRecord });
		return () => controller.abort();
	}, [scope, recordID, refreshToken, environmentID]);

	const start = async (signal: AbortSignal) => {
		const client = useClientManager.getState().client;
		if (!canPatch || !client) return;
		const expected = live.current.scope;
		const trimmedTimeout = timeout.trim();
		const seconds = /^[+-]?\d+$/.test(trimmedTimeout) ? parseInt(trimmedTimeout, 10) : undefined;
		if (!(trimmedTimeout === '' || (seconds ?? 0) > 0)) {
			showToast(Toasts.error('Enter a positive timeout in seconds.'));
			return;
		}
		setSubmitting(true);
		await withCleanup(
			() =>
				submitPatch({
					client,
					signal,
					environmentID,
					imageID,
					options: { suffix, patchedTag, timeoutSeconds: seconds, scanID, ignoreErrors },
					isCurrent: () => expected === live.current.scope,
					setRecord
				}),
			() => setSubmitting(false)
		);
	};

	return {
		imageName,
		localOnly,
		fields: { suffix, patchedTag, scanID, timeout, ignoreErrors },
		set: { setSuffix, setPatchedTag, setScanID, setTimeout: setTimeoutText, setIgnoreErrors },
		record,
		activity,
		submitting,
		availabilityError,
		canPatch,
		patch: () => {
			cancelPatch();
			const controller = new AbortController();
			live.current.patch = controller;
			void start(controller.signal);
		},
		refreshStatus: () => setRefreshToken((value) => value + 1),
		openActivity: () => {
			if (activity) activityNav.openActivity(activity);
		}
	};
}

export type ImagePatchModel = ReturnType<typeof useImagePatch>;
export type ImagePatchTargetsModel = ReturnType<typeof useImagePatchTargets>;
