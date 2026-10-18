import { useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import { hasPermission } from '@/core/auth/permissions';
import { ResponseCache } from '@/core/networking/response-cache';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { ArcaneError } from '@/sdk/errors/ArcaneError';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { Permission } from '@/sdk/models/role/Permission';
import type { PublicSetting } from '@/sdk/models/settings/Settings';
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

async function loadPruneDefaults(
	client: ArcaneClient,
	environmentID: EnvironmentID,
	isCancelled: () => boolean,
	setters: {
		setContainerMode: (mode: PruneContainerMode) => void;
		setContainerAge: (age: string) => void;
		setImageMode: (mode: PruneImageMode) => void;
		setImageAge: (age: string) => void;
		setVolumeMode: (mode: PruneVolumeMode) => void;
		setNetworkMode: (mode: PruneNetworkMode) => void;
		setNetworkAge: (age: string) => void;
		setBuildCacheMode: (mode: PruneBuildCacheMode) => void;
		setBuildCacheAge: (age: string) => void;
	}
) {
	try {
		const text = await client.transport.rawRequest(
			client.rest.environmentPath(environmentID, 'settings')
		);
		const settings = JSON.parse(text) as PublicSetting[] | { data?: PublicSetting[] };
		const list = Array.isArray(settings) ? settings : (settings.data ?? []);
		if (isCancelled()) return;
		const dict = new Map(list.map((s) => [s.key, s.value]));
		const mode = (key: string) => dict.get(key);
		const until = (key: string) => {
			const value = dict.get(key);
			return value ? value : undefined;
		};
		const c = mode('pruneContainerMode');
		if (isOneOf(pruneOptions.containers, c)) setters.setContainerMode(c);
		const cu = until('pruneContainerUntil');
		if (cu) setters.setContainerAge(cu);
		const i = mode('pruneImageMode');
		if (isOneOf(pruneOptions.images, i)) setters.setImageMode(i);
		const iu = until('pruneImageUntil');
		if (iu) setters.setImageAge(iu);
		const v = mode('pruneVolumeMode');
		if (isOneOf(pruneOptions.volumes, v)) setters.setVolumeMode(v);
		const n = mode('pruneNetworkMode');
		if (isOneOf(pruneOptions.networks, n)) setters.setNetworkMode(n);
		const nu = until('pruneNetworkUntil');
		if (nu) setters.setNetworkAge(nu);
		const b = mode('pruneBuildCacheMode');
		if (isOneOf(pruneOptions.buildCache, b)) setters.setBuildCacheMode(b);
		const bu = until('pruneBuildCacheUntil');
		if (bu) setters.setBuildCacheAge(bu);
	} catch {}
}

async function performPrune({
	clientGeneration,
	client,
	environments,
	environmentID,
	request,
	supportsActivities,
	onDismiss,
	markChanged
}: {
	clientGeneration: number;
	client: ArcaneClient;
	environments: Environment[] | undefined;
	environmentID: EnvironmentID;
	request: PruneAllRequest;
	supportsActivities: boolean;
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
		const result = await client.system.prune({ options: request, envID: environmentID });
		ResponseCache.invalidateEnvironment(environmentID);
		markChanged(environmentID);
		if (!supportsActivities) showToast(Toasts.success(formatPruneResult(result)));
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
	const [containerMode, setContainerMode] = useState<PruneContainerMode>('none');
	const [containerAge, setContainerAge] = useState('24h');
	const [imageMode, setImageMode] = useState<PruneImageMode>('none');
	const [imageAge, setImageAge] = useState('24h');
	const [volumeMode, setVolumeMode] = useState<PruneVolumeMode>('none');
	const [networkMode, setNetworkMode] = useState<PruneNetworkMode>('none');
	const [networkAge, setNetworkAge] = useState('24h');
	const [buildCacheMode, setBuildCacheMode] = useState<PruneBuildCacheMode>('none');
	const [buildCacheAge, setBuildCacheAge] = useState('24h');
	const [isPruning, setIsPruning] = useState(false);
	const operationRunning = useAllEnvironmentsOperationStore((s) => s.isRunning);
	const supportsActivities = useClientManager((s) => s.serverCapabilities?.mode === 'rbac');

	const isAll = environments !== undefined;
	const selectedCount = [containerMode, imageMode, volumeMode, networkMode, buildCacheMode].filter(
		(m) => m !== 'none'
	).length;

	useEffect(() => {
		if (isAll) return;
		const client = useClientManager.getState().client;
		if (!client) return;
		let cancelled = false;
		void loadPruneDefaults(client, environmentID, () => cancelled, {
			setContainerMode,
			setContainerAge,
			setImageMode,
			setImageAge,
			setVolumeMode,
			setNetworkMode,
			setNetworkAge,
			setBuildCacheMode,
			setBuildCacheAge
		});
		return () => {
			cancelled = true;
		};
	}, [environmentID, isAll]);

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
					supportsActivities,
					onDismiss,
					markChanged
				}),
			() => setIsPruning(false)
		);
	};

	return {
		isAll,
		title: isAll ? 'Prune All Environments' : 'System Prune',
		confirmButtonTitle: isAll
			? 'Prune All'
			: selectedCount > 0
				? `Prune (${selectedCount})`
				: 'Prune',
		confirmDisabled: selectedCount === 0 || operationRunning || environments?.length === 0,
		confirmation: {
			title: isAll ? 'Prune all environments?' : 'Prune resources?',
			message: isAll
				? 'Remove the selected resources across all enabled environments. Removed data cannot be recovered.'
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
