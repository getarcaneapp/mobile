import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { isCancellation } from '@/core/errors';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import type { ContainerEditConfig } from '@/sdk/models/container/ContainerEditing';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { containersChanged } from './container-actions';
import {
	createRequest,
	draftFromConfig,
	draftsEqual,
	editRequest,
	emptyDraft,
	newMountDraft,
	newNetworkDraft,
	newPortDraft,
	type ContainerConfigurationDraft,
	type ContainerMountDraft,
	type ContainerNetworkDraft,
	type ContainerPortDraft
} from './container-configuration-draft';
import { routePayloads } from './container-routes';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useContainerConfiguration() {
	const router = useRouter();
	const {
		envID = '0',
		containerID,
		token
	} = useLocalSearchParams<{ envID?: string; containerID?: string; token?: string }>();
	const environmentID = envID;
	const onSaved = routePayloads.get<(id: string) => boolean | void>(token);
	const [draft, setDraft] = useState<ContainerConfigurationDraft>(emptyDraft);
	const [original, setOriginal] = useState<ContainerConfigurationDraft>(emptyDraft);
	const [config, setConfig] = useState<ContainerEditConfig>();
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const [review, setReview] = useState(false);
	const generation = useClientManager((s) => s.clientGeneration);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	useClientManager((s) => s.accessGeneration);
	const abort = useRef<AbortController | undefined>(undefined);
	const loadedGeneration = useRef(-1);
	const initial = useRef({ generation, activeEnvironmentID });

	const blocked = config?.editDisabled === true || config?.isCompose === true;
	const permission = containerID === undefined ? Permission.Containers.create : 'containers:edit';

	const dismiss = () => {
		abort.current?.abort();
		routePayloads.delete(token);
		router.back();
	};

	useEffect(() => {
		if (generation !== initial.current.generation) dismiss();
		else if (
			activeEnvironmentID !== initial.current.activeEnvironmentID &&
			activeEnvironmentID !== environmentID
		)
			dismiss();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [generation, activeEnvironmentID]);
	useEffect(() => () => abort.current?.abort(), []);

	useEffect(() => {
		const requestGeneration = useClientManager.getState().clientGeneration;
		loadedGeneration.current = requestGeneration;
		setLoading(true);
		setError(undefined);
		const client = useClientManager.getState().client;
		if (!client) {
			setLoading(false);
			setError('Connect to a server to continue.');
			return;
		}
		if (containerID === undefined) {
			setLoading(false);
			return;
		}
		const controller = new AbortController();
		client
			.withSignal(controller.signal)
			.containers.editConfig({ envID: environmentID, id: containerID })
			.then((loaded) => {
				if (requestGeneration !== useClientManager.getState().clientGeneration) return;
				const next = draftFromConfig(loaded);
				setConfig(loaded);
				setDraft(next);
				setOriginal(next);
				setLoading(false);
			})
			.catch((e: unknown) => {
				if (controller.signal.aborted || isCancellation(e)) return;
				setLoading(false);
				if (isArcaneError(e, 'notFound'))
					setError(
						'Container editing is unavailable on this server, or the container no longer exists.'
					);
				else if (isArcaneError(e, 'forbidden'))
					setError('You do not have permission to read this container configuration.');
				else setError(errorText(e));
			});
		return () => controller.abort();
	}, [environmentID, containerID]);

	const save = async () => {
		const client = useClientManager.getState().client;
		if (!client || loadedGeneration.current !== useClientManager.getState().clientGeneration)
			return;
		if (!hasPermission(permission, environmentID) || blocked) return;
		const controller = new AbortController();
		abort.current = controller;
		const run = loadedGeneration.current;
		setBusy(true);
		try {
			const scoped = client.withSignal(controller.signal);
			const id =
				containerID !== undefined
					? (
							await scoped.containers.edit({
								envID: environmentID,
								id: containerID,
								body: editRequest(draft, original)
							})
						).id
					: (await scoped.containers.create({ envID: environmentID, body: createRequest(draft) }))
							.id;
			if (controller.signal.aborted || run !== useClientManager.getState().clientGeneration) return;
			containersChanged(environmentID);
			showToast(
				Toasts.success(containerID === undefined ? 'Container created' : 'Container updated')
			);
			routePayloads.delete(token);
			if (onSaved?.(id) !== true) router.back();
		} catch (e) {
			if (controller.signal.aborted || isCancellation(e)) return;
			setError(errorText(e));
			showToast(Toasts.error(errorText(e)));
		} finally {
			setBusy(false);
		}
	};

	const confirm = () => {
		if (containerID !== undefined && !review) {
			try {
				editRequest(draft, original);
				setError(undefined);
				setReview(true);
			} catch (e) {
				setError(errorText(e));
			}
		} else {
			void save();
		}
	};

	const update = (patch: Partial<ContainerConfigurationDraft>) =>
		setDraft((current) => ({ ...current, ...patch }));
	const updateItem =
		<K extends 'ports' | 'mounts' | 'networks'>(key: K) =>
		(id: string, patch: Partial<ContainerConfigurationDraft[K][number]>) =>
			setDraft((current) => ({
				...current,
				[key]: (current[key] as { id: string }[]).map((item) =>
					item.id === id ? { ...item, ...patch } : item
				)
			}));
	const removeItem = (key: 'ports' | 'mounts' | 'networks', id: string) =>
		setDraft((current) => ({
			...current,
			[key]: (current[key] as { id: string }[]).filter((item) => item.id !== id)
		}));

	const networkMode = config?.hostConfig.networkMode;
	const preservesNetworkMode =
		networkMode !== undefined &&
		(['host', 'none'].includes(networkMode) || networkMode.startsWith('container:'));

	return {
		isCreate: containerID === undefined,
		title: containerID === undefined ? 'Create Container' : 'Edit Container',
		confirmTitle: containerID === undefined ? 'Create' : review ? 'Recreate' : 'Review',
		cancelTitle: review ? 'Back' : 'Cancel',
		draft,
		config,
		loading,
		busy,
		error,
		review,
		blocked,
		networkMode,
		preservesNetworkMode,
		canOpenProject:
			config?.composeProject !== undefined &&
			hasPermission(Permission.Projects.list, environmentID) &&
			hasPermission(Permission.Projects.read, environmentID),
		confirmDisabled:
			loading ||
			busy ||
			blocked ||
			!hasPermission(permission, environmentID) ||
			(containerID !== undefined && draftsEqual(draft, original)),
		update,
		updatePort: updateItem('ports') as (id: string, patch: Partial<ContainerPortDraft>) => void,
		updateMount: updateItem('mounts') as (id: string, patch: Partial<ContainerMountDraft>) => void,
		updateNetwork: updateItem('networks') as (
			id: string,
			patch: Partial<ContainerNetworkDraft>
		) => void,
		addPort: () => update({ ports: [...draft.ports, newPortDraft()] }),
		addMount: () => update({ mounts: [...draft.mounts, newMountDraft()] }),
		addNetwork: () => update({ networks: [...draft.networks, newNetworkDraft()] }),
		removeItem,
		confirm,
		cancel: () => (review ? setReview(false) : dismiss())
	};
}

export type ContainerConfigurationModel = ReturnType<typeof useContainerConfiguration>;
