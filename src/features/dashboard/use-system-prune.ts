import { useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import { hasPermission } from '@/core/auth/permissions';
import { loadPruneDefaults } from '@/core/prune-defaults';
import { ResponseCache } from '@/core/networking/response-cache';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { ArcaneError } from '@/sdk/errors/ArcaneError';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { Permission } from '@/sdk/models/role/Permission';
import type {
	PruneAllRequest,
	PruneBuildCacheMode,
	PruneContainerMode,
	PruneImageMode,
	PruneNetworkMode,
	PruneVolumeMode
} from '@/sdk/models/system/Prune';
import { useAllEnvironmentsOperationStore } from '@/stores/all-environments-operation-store';
import { useClientManager } from '@/stores/client-manager';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { showToast, Toasts } from '@/ui/toast';

import { formatPruneResult } from './dashboard-logic';

export const pruneOptions = {
	containers: [
		{ label: 'None', value: 'none' },
		{ label: 'Stopped', value: 'stopped' },
		{ label: 'Older than...', value: 'olderThan' }
	] as { label: string; value: PruneContainerMode }[],
	images: [
		{ label: 'None', value: 'none' },
		{ label: 'Dangling', value: 'dangling' },
		{ label: 'All Unused', value: 'all' },
		{ label: 'Older than...', value: 'olderThan' }
	] as { label: string; value: PruneImageMode }[],
	volumes: [
		{ label: 'None', value: 'none' },
		{ label: 'Anonymous', value: 'anonymous' },
		{ label: 'All Unused', value: 'all' }
	] as { label: string; value: PruneVolumeMode }[],
	networks: [
		{ label: 'None', value: 'none' },
		{ label: 'Unused', value: 'unused' },
		{ label: 'Older than...', value: 'olderThan' }
	] as { label: string; value: PruneNetworkMode }[],
	buildCache: [
		{ label: 'None', value: 'none' },
		{ label: 'Unused', value: 'unused' },
		{ label: 'All', value: 'all' },
		{ label: 'Older than...', value: 'olderThan' }
	] as { label: string; value: PruneBuildCacheMode }[]
};

const isOneOf = <T extends string>(options: { value: T }[], raw: string | undefined): raw is T =>
	raw !== undefined && options.some((o) => o.value === raw);

type PruneDefaultSetters = {
	setContainerMode: (mode: PruneContainerMode) => void;
	setContainerAge: (age: string) => void;
	setImageMode: (mode: PruneImageMode) => void;
	setImageAge: (age: string) => void;
	setVolumeMode: (mode: PruneVolumeMode) => void;
	setNetworkMode: (mode: PruneNetworkMode) => void;
	setNetworkAge: (age: string) => void;
	setBuildCacheMode: (mode: PruneBuildCacheMode) => void;
	setBuildCacheAge: (age: string) => void;
	setDefaultsLoaded: (loaded: boolean) => void;
};

async function applyPruneDefaults(
	client: ArcaneClient,
	environmentIDs: readonly EnvironmentID[],
	isCancelled: () => boolean,
	setters: PruneDefaultSetters
) {
	const defaults = await loadPruneDefaults(client, environmentIDs);
	if (isCancelled()) return;
	const c = defaults.pruneContainerMode;
	if (isOneOf(pruneOptions.containers, c)) setters.setContainerMode(c);
	if (defaults.pruneContainerUntil) setters.setContainerAge(defaults.pruneContainerUntil);
	const i = defaults.pruneImageMode;
	if (isOneOf(pruneOptions.images, i)) setters.setImageMode(i);
	if (defaults.pruneImageUntil) setters.setImageAge(defaults.pruneImageUntil);
	const v = defaults.pruneVolumeMode;
	if (isOneOf(pruneOptions.volumes, v)) setters.setVolumeMode(v);
	const n = defaults.pruneNetworkMode;
	if (isOneOf(pruneOptions.networks, n)) setters.setNetworkMode(n);
	if (defaults.pruneNetworkUntil) setters.setNetworkAge(defaults.pruneNetworkUntil);
	const b = defaults.pruneBuildCacheMode;
	if (isOneOf(pruneOptions.buildCache, b)) setters.setBuildCacheMode(b);
	if (defaults.pruneBuildCacheUntil) setters.setBuildCacheAge(defaults.pruneBuildCacheUntil);
	setters.setDefaultsLoaded(true);
}

async function performPrune({
	clientGeneration,
	client,
	environments,
	environmentID,
	request,
	onDismiss,
	markChanged
}: {
	clientGeneration: number;
	client: ArcaneClient;
	environments: Environment[] | undefined;
	environmentID: EnvironmentID;
	request: PruneAllRequest;
	onDismiss: () => void;
	markChanged: (id: EnvironmentID) => void;
}) {
	try {
		if (environments) {
			const session = clientGeneration;
			const isCurrent = () => session === useClientManager.getState().clientGeneration;
			onDismiss();
			await useAllEnvironmentsOperationStore.getState().runWithToast({
				title: 'Cleaning up…',
				completionTitle: 'Cleanup complete',
				symbol: 'trash',
				isDestructive: true,
				environments,
				isCurrent,
				operation: async (id) => {
					if (!hasPermission(Permission.System.prune, id))
						throw ArcaneError.transport('Not run: no prune permission');
					const result = await client.system.prune({ options: request, envID: id });
					if (!isCurrent()) return 'Completed on previous connection';
					ResponseCache.invalidateEnvironment(id);
					markChanged(id);
					return formatPruneResult(result);
				}
			});
			return;
		}
		await client.system.prune({ options: request, envID: environmentID });
		ResponseCache.invalidateEnvironment(environmentID);
		markChanged(environmentID);
		onDismiss();
	} catch (error) {
		showToast(Toasts.error(friendlyErrorMessage(error)));
	}
}

export function useSystemPrune({
	environmentID,
	environments,
	onDismiss
}: {
	environmentID: EnvironmentID;
	environments?: Environment[];
	onDismiss: () => void;
}) {
	const [containerMode, setContainerMode] = useState<PruneContainerMode>('stopped');
	const [containerAge, setContainerAge] = useState('24h');
	const [imageMode, setImageMode] = useState<PruneImageMode>('dangling');
	const [imageAge, setImageAge] = useState('24h');
	const [volumeMode, setVolumeMode] = useState<PruneVolumeMode>('none');
	const [networkMode, setNetworkMode] = useState<PruneNetworkMode>('unused');
	const [networkAge, setNetworkAge] = useState('24h');
	const [buildCacheMode, setBuildCacheMode] = useState<PruneBuildCacheMode>('none');
	const [buildCacheAge, setBuildCacheAge] = useState('24h');
	const [defaultsLoaded, setDefaultsLoaded] = useState(false);
	const [isPruning, setIsPruning] = useState(false);
	const operationRunning = useAllEnvironmentsOperationStore((s) => s.isRunning);

	const isAll = environments !== undefined;
	const selectedCount = [containerMode, imageMode, volumeMode, networkMode, buildCacheMode].filter(
		(m) => m !== 'none'
	).length;

	const targetKey = (environments?.map((environment) => environment.id) ?? [environmentID]).join(
		'\n'
	);
	useEffect(() => {
		const client = useClientManager.getState().client;
		if (!client) return;
		let cancelled = false;
		setDefaultsLoaded(false);
		void applyPruneDefaults(
			client,
			targetKey === '' ? [] : targetKey.split('\n'),
			() => cancelled,
			{
				setContainerMode,
				setContainerAge,
				setImageMode,
				setImageAge,
				setVolumeMode,
				setNetworkMode,
				setNetworkAge,
				setBuildCacheMode,
				setBuildCacheAge,
				setDefaultsLoaded
			}
		);
		return () => {
			cancelled = true;
		};
	}, [targetKey]);

	const request: PruneAllRequest = {
		containers:
			containerMode !== 'none'
				? { mode: containerMode, until: containerMode === 'olderThan' ? containerAge : undefined }
				: undefined,
		images:
			imageMode !== 'none'
				? { mode: imageMode, until: imageMode === 'olderThan' ? imageAge : undefined }
				: undefined,
		volumes: volumeMode !== 'none' ? { mode: volumeMode } : undefined,
		networks:
			networkMode !== 'none'
				? { mode: networkMode, until: networkMode === 'olderThan' ? networkAge : undefined }
				: undefined,
		buildCache:
			buildCacheMode !== 'none'
				? {
						mode: buildCacheMode,
						until: buildCacheMode === 'olderThan' ? buildCacheAge : undefined
					}
				: undefined
	};

	const markChanged = (id: EnvironmentID) => {
		const mutations = useResourceMutationStore.getState();
		if (containerMode !== 'none') mutations.markChanged('containers', id);
		if (imageMode !== 'none') mutations.markChanged('images', id);
		if (volumeMode !== 'none') mutations.markChanged('volumes', id);
		if (networkMode !== 'none') mutations.markChanged('networks', id);
	};

	const runPrune = async () => {
		const manager = useClientManager.getState();
		const client = manager.client;
		if (!client) return;
		setIsPruning(true);
		await withCleanup(
			() =>
				performPrune({
					clientGeneration: manager.clientGeneration,
					client,
					environments,
					environmentID,
					request,
					onDismiss,
					markChanged
				}),
			() => setIsPruning(false)
		);
	};

	return {
		isAll,
		title: isAll ? 'Prune All Agents' : 'System Prune',
		confirmButtonTitle: isAll
			? 'Prune All'
			: selectedCount > 0
				? `Prune (${selectedCount})`
				: 'Prune',
		confirmDisabled:
			!defaultsLoaded || selectedCount === 0 || operationRunning || environments?.length === 0,
		confirmation: {
			title: isAll ? 'Prune all agents?' : 'Prune resources?',
			message: isAll
				? 'Remove the selected resources across all enabled agents. Removed data cannot be recovered.'
				: 'Remove the selected resources. Removed data cannot be recovered.',
			icon: 'trash',
			confirmTitle: isAll ? 'Prune All' : 'Prune'
		},
		isPruning,
		runPrune,
		containerMode,
		setContainerMode,
		containerAge,
		setContainerAge,
		imageMode,
		setImageMode,
		imageAge,
		setImageAge,
		volumeMode,
		setVolumeMode,
		networkMode,
		setNetworkMode,
		networkAge,
		setNetworkAge,
		buildCacheMode,
		setBuildCacheMode,
		buildCacheAge,
		setBuildCacheAge
	};
}

export type SystemPruneModel = ReturnType<typeof useSystemPrune>;
