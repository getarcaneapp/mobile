import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import { Pod, type PodAction, type PodInspect, type PodTop } from '@/sdk/models/podman/Pod';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { systemColors } from '@/theme/colors';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { useDebounced, useOnChange } from '@/features/containers/hooks';
import { screenCache } from '@/features/networks/tab-routes';

import {
	plural,
	podmanChanged,
	podmanDate,
	shortID,
	usePodmanCan,
	usePodmanVersion
} from './podman-common';
import { isRunningPod, memoryLimitLabel, podActionInfo, podActions } from './podman-logic';
import { podmanKeys, usePodmanNavigation } from './podman-routes';
import type { PodmanMenuAction } from './podman-parts.types';
import { usePodmanPagedList } from './use-podman-list';

async function runPodAction(
	environmentID: EnvironmentID,
	pod: Pod | PodInspect,
	action: PodAction
) {
	const client = useClientManager.getState().client;
	if (!client) return false;
	const info = podActionInfo[action];
	try {
		await client.podman.podAction({ podId: pod.id, action, envID: environmentID });
		podmanChanged(environmentID);
		showToast(Toasts.success(`${info.title}: ${Pod.displayName(pod)}`));
		return true;
	} catch (error) {
		showToast(Toasts.error(friendlyErrorMessage(error)));
		return false;
	}
}

async function removePod(environmentID: EnvironmentID, pod: Pod | PodInspect, force: boolean) {
	const client = useClientManager.getState().client;
	if (!client) return false;
	try {
		await client.podman.removePod({ podId: pod.id, force, envID: environmentID });
		podmanChanged(environmentID);
		showToast(Toasts.success('Pod removed'));
		return true;
	} catch (error) {
		showToast(Toasts.error(friendlyErrorMessage(error)));
		return false;
	}
}

async function prunePods(environmentID: EnvironmentID) {
	const client = useClientManager.getState().client;
	if (!client) return;
	try {
		const reports = await client.podman.prunePods({ envID: environmentID });
		podmanChanged(environmentID);
		showToast(Toasts.success(pruneMessage(reports.length)));
	} catch (error) {
		showToast(Toasts.error(friendlyErrorMessage(error)));
	}
}

function pruneMessage(count: number) {
	return count === 0 ? 'No stopped pods' : `Removed ${plural(count, 'pod')}`;
}

export function usePodmanPods() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const environmentID = envID;
	const podman = usePodmanNavigation();
	const can = usePodmanCan(environmentID);
	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);
	const [pendingDelete, setPendingDelete] = useState<Pod>();
	const [pendingPrune, setPendingPrune] = useState<true>();
	const paged = usePodmanPagedList<Pod>(
		environmentID,
		(client, args) => client.podman.listPods(args),
		debouncedSearch
	);
	const canDelete = can(Permission.Podman.podsDelete);
	const canPrune = can(Permission.Podman.podsPrune);
	const canRead = can(Permission.Podman.podsRead);

	useItemDeleteConfirmation(pendingDelete, setPendingDelete, (pod) => ({
		title: 'Remove Pod',
		message: isRunningPod(pod.status)
			? `Remove “${Pod.displayName(pod)}”? Its running containers are stopped and removed.`
			: `Remove “${Pod.displayName(pod)}” and its containers?`,
		icon: 'trash',
		actions: [
			{
				title: 'Remove',
				action: () =>
					void removePod(environmentID, pod, isRunningPod(pod.status)).then((removed) => {
						if (removed)
							paged.list.updateItems((items) => items.filter((item) => item.value.id !== pod.id));
					})
			}
		],
		dismissOnConfirm: false
	}));

	useItemDeleteConfirmation(pendingPrune, setPendingPrune, () => ({
		title: 'Prune Pods',
		message: 'Remove every stopped pod?',
		icon: 'scissors',
		actions: [{ title: 'Prune', action: () => void prunePods(environmentID) }],
		dismissOnConfirm: false
	}));

	const menuActions = (pod: Pod): PodmanMenuAction[] => {
		const actions: PodmanMenuAction[] = podActions(pod.status)
			.map((action) => podActionInfo[action])
			.filter((info) => can(info.permission) && !info.destructive)
			.map((info) => ({
				id: info.action,
				title: info.title,
				systemImage: info.systemImage,
				onPress: () => void runPodAction(environmentID, pod, info.action)
			}));
		if (canDelete)
			actions.push({
				id: 'remove',
				title: 'Remove',
				systemImage: 'trash',
				destructive: true,
				onPress: () => setPendingDelete(pod)
			});
		return actions;
	};

	return {
		...paged,
		environmentID,
		setSearchText,
		emptyTitle: debouncedSearch === '' ? 'No Pods' : 'No Results',
		canDelete,
		canPrune,
		menuActions,
		containersText: (pod: Pod) => plural(pod.containers.length, 'container'),
		openDetail: (pod: Pod) => {
			if (canRead) podman.openPod(environmentID, pod);
		},
		requestDelete: (pod: Pod) => setPendingDelete(pod),
		requestPrune: () => setPendingPrune(true)
	};
}

export type PodmanPodsModel = ReturnType<typeof usePodmanPods>;

async function fetchPod(environmentID: EnvironmentID, id: string) {
	const client = useClientManager.getState().client;
	if (!client) return undefined;
	const [inspect, top] = await Promise.all([
		client.podman.pod({ podId: id, envID: environmentID }),
		client.podman.podTop({ podId: id, envID: environmentID }).catch(() => undefined)
	]);
	return { inspect, top };
}

export function usePodmanPodDetail() {
	const {
		id = '',
		envID = '0',
		name
	} = useLocalSearchParams<{
		id?: string;
		envID?: string;
		name?: string;
	}>();
	const environmentID = envID;
	const podman = usePodmanNavigation();
	const can = usePodmanCan(environmentID);
	const client = useClientManager((s) => s.client);
	const [summary] = useState(() => screenCache.get<Pod>(podmanKeys.pod(environmentID, id)));
	const [inspect, setInspect] = useState<PodInspect>();
	const [top, setTop] = useState<PodTop>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const [runningAction, setRunningAction] = useState<string>();
	const [removed, setRemoved] = useState(false);
	const loading = useRef(false);

	const load = useCallback(async () => {
		if (loading.current) return;
		loading.current = true;
		await withCleanup(
			async () => {
				try {
					const fetched = await fetchPod(environmentID, id);
					if (!fetched) return;
					setInspect(fetched.inspect);
					setTop(fetched.top);
					setErrorMessage(undefined);
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => {
				loading.current = false;
			}
		);
	}, [environmentID, id]);

	useEffect(() => {
		void load();
	}, [load, client]);
	useOnChange(usePodmanVersion(environmentID), () => {
		if (!removed) void load();
	});

	const displayName = inspect?.name || summary?.name || name || shortID(id);
	const state = inspect?.state ?? summary?.status ?? '';

	const perform = async (action: string, body: () => Promise<boolean>) => {
		setRunningAction(action);
		await withCleanup(
			async () => {
				await body();
			},
			() => setRunningAction(undefined)
		);
	};

	const target = inspect ?? summary;
	const lifecycle: ActionButtonItem[] = target
		? podActions(state)
				.map((action) => podActionInfo[action])
				.filter((info) => can(info.permission))
				.map((info) => ({
					id: info.action,
					title: info.title,
					systemImage: info.systemImage,
					tint: info.destructive ? systemColors.red : systemColors.blue,
					role: info.destructive ? ('destructive' as const) : undefined,
					confirmationMessage: info.confirmationMessage,
					action: () =>
						void perform(info.action, () => runPodAction(environmentID, target, info.action))
				}))
		: [];

	const overflow: ActionButtonItem[] = [];
	if (target && can(Permission.Podman.kubeRead))
		overflow.push({
			id: 'kube',
			title: 'Generate Kube YAML',
			systemImage: 'square.stack.3d.down.right',
			tint: systemColors.blue,
			action: () => podman.openKube(environmentID, displayName)
		});
	if (target && can(Permission.Podman.podsDelete))
		overflow.push({
			id: 'remove',
			title: 'Remove',
			systemImage: 'trash',
			tint: systemColors.red,
			role: 'destructive',
			confirmationMessage: isRunningPod(state)
				? 'Its running containers are stopped and removed.'
				: 'Its containers are removed.',
			dismissOnConfirm: false,
			action: () =>
				void perform('remove', async () => {
					const ok = await removePod(environmentID, target, isRunningPod(state));
					if (ok) {
						setRemoved(true);
						podman.nav.back();
					}
					return ok;
				})
		});

	const primary = lifecycle.find((item) => item.role !== 'destructive');
	const secondary = lifecycle.filter((item) => item !== primary);

	const overview: { title: string; value: string }[] = [];
	if (inspect) {
		overview.push({ title: 'Created', value: podmanDate(inspect.created) });
		if (inspect.hostname) overview.push({ title: 'Hostname', value: inspect.hostname });
		if (inspect.restartPolicy)
			overview.push({ title: 'Restart Policy', value: inspect.restartPolicy });
		if (inspect.exitPolicy) overview.push({ title: 'Exit Policy', value: inspect.exitPolicy });
		if (inspect.sharedNamespaces.length > 0)
			overview.push({ title: 'Shared Namespaces', value: inspect.sharedNamespaces.join(', ') });
		if (inspect.networks.length > 0)
			overview.push({ title: 'Networks', value: inspect.networks.join(', ') });
		if (inspect.cpusetCpus) overview.push({ title: 'CPUs', value: inspect.cpusetCpus });
		const memory = memoryLimitLabel(inspect.memoryLimit);
		if (memory) overview.push({ title: 'Memory Limit', value: memory });
		if (inspect.cgroupParent)
			overview.push({ title: 'Cgroup Parent', value: inspect.cgroupParent });
	}

	const containers = (inspect?.containers ?? [])
		.slice()
		.sort((a, b) => Number(a.isInfra) - Number(b.isInfra) || a.name.localeCompare(b.name));

	const processes = (top?.processes ?? []).slice(0, 200).map((row, index) => ({
		id: `${index}`,
		text: row.join('  ')
	}));

	return {
		environmentID,
		id,
		displayName,
		state,
		inspect,
		top,
		errorMessage,
		load,
		overview,
		containers,
		processes,
		processHeader: (top?.titles ?? []).join('  '),
		labels: Object.entries(inspect?.labels ?? {}).sort(([a], [b]) => a.localeCompare(b)),
		toolbar: {
			primary,
			secondary,
			overflow,
			runningItemID: runningAction,
			isDisabled: runningAction !== undefined
		}
	};
}

export type PodmanPodDetailModel = ReturnType<typeof usePodmanPodDetail>;
