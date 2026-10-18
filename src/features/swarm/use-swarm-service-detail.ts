import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { Permission } from '@/sdk/models/role/Permission';
import type { SwarmServiceInspect, SwarmServiceSummary } from '@/sdk/models/swarm/SwarmServices';
import { useClientManager } from '@/stores/client-manager';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import type { ScrollableTabOption } from '@/ui/components/scrollable-tab-bar.types';
import { showToast, Toasts } from '@/ui/toast';

import { useOnChange } from '@/features/containers/hooks';
import { screenCache } from '@/features/networks/tab-routes';

import {
	capitalized,
	shortID,
	swarmArray,
	swarmChanged,
	swarmDate,
	swarmField,
	swarmString,
	swarmVersionIndex,
	useCan,
	useSwarmVersion
} from './swarm-common';
import { swarmKeys, useSwarmNavigation } from './swarm-routes';
import { draftFromSpec, type SwarmServiceMode } from './swarm-spec-draft';

export type ServiceDetailTab = 'overview' | 'tasks' | 'logs';

const allTabs: ScrollableTabOption<ServiceDetailTab>[] = [
	{
		value: 'overview',
		title: 'Overview',
		systemImage: 'info.circle.fill',
		tint: systemColors.purple
	},
	{ value: 'tasks', title: 'Tasks', systemImage: 'checklist', tint: systemColors.blue },
	{ value: 'logs', title: 'Logs', systemImage: 'text.alignleft', tint: systemColors.teal }
];

const knownModes: SwarmServiceMode[] = ['replicated', 'global', 'job'];

function firstWarning(response: { warnings?: string[] }): string | undefined {
	return response.warnings?.[0];
}

async function loadServiceDetail(
	current: ArcaneClient,
	environmentID: EnvironmentID,
	serviceID: string,
	initialName: string | undefined,
	setInspect: (value: SwarmServiceInspect) => void,
	setErrorMessage: (value: string | undefined) => void,
	setSummary: (value: SwarmServiceSummary) => void
) {
	let freshName = initialName;
	try {
		const result = await current.swarm.service({ serviceId: serviceID, envID: environmentID });
		setInspect(result);
		setErrorMessage(undefined);
		freshName = draftFromSpec(result.spec).name || freshName;
	} catch (error) {
		setErrorMessage(friendlyErrorMessage(error));
	}
	if (freshName) {
		const response = await current.swarm
			.listServices({ envID: environmentID, search: freshName, limit: 50 })
			.catch(() => undefined);
		const match = response?.data.find((service) => service.id === serviceID);
		if (match) {
			setSummary(match);
			screenCache.set(swarmKeys.service(environmentID, serviceID), match);
		}
	}
}

export function useSwarmServiceDetail() {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const environmentID = envID;
	const serviceID = id;
	const swarm = useSwarmNavigation();
	const accent = useAccentColor();
	const can = useCan(environmentID);
	const client = useClientManager((s) => s.client);
	const swarmVersion = useSwarmVersion(environmentID);

	const [summary, setSummary] = useState<SwarmServiceSummary | undefined>(() =>
		screenCache.get<SwarmServiceSummary>(swarmKeys.service(environmentID, serviceID))
	);
	const [inspect, setInspect] = useState<SwarmServiceInspect>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const [selectedTab, setSelectedTab] = useState<ServiceDetailTab>('overview');
	const [runningActionID, setRunningActionID] = useState<string>();
	const isLoading = useRef(false);

	const draft = useMemo(() => (inspect ? draftFromSpec(inspect.spec) : undefined), [inspect]);
	const name = draft?.name ?? summary?.name ?? shortID(serviceID);
	const canManage = can(Permission.Swarm.services);
	const canReadLogs = can(Permission.Swarm.servicesLogs);

	const latestName = useRef<string | undefined>(undefined);
	const currentName = draft?.name ?? summary?.name;
	useLayoutEffect(() => {
		latestName.current = currentName;
	});

	const load = useCallback(async () => {
		const current = useClientManager.getState().client;
		if (!current || isLoading.current) return;
		isLoading.current = true;
		const initialName = latestName.current;
		await withCleanup(
			() =>
				loadServiceDetail(
					current,
					environmentID,
					serviceID,
					initialName,
					setInspect,
					setErrorMessage,
					setSummary
				),
			() => {
				isLoading.current = false;
			}
		);
	}, [environmentID, serviceID]);

	useEffect(() => {
		void load();
	}, [load, client]);
	useOnChange(swarmVersion, () => void load());

	const isReplicated = (draft?.mode ?? 'replicated') === 'replicated' && summary !== undefined;
	const tabs = allTabs.filter((tab) => tab.value !== 'logs' || canReadLogs);

	const rollback = async () => {
		const current = useClientManager.getState().client;
		if (!current) return;
		setRunningActionID('rollback');
		await withCleanup(
			async () => {
				try {
					const response = await current.swarm.rollbackService({
						serviceId: serviceID,
						envID: environmentID
					});
					swarmChanged(environmentID);
					showToast(Toasts.success('Rollback started'));
					const warning = firstWarning(response);
					if (warning) showToast(Toasts.info(warning));
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setRunningActionID(undefined)
		);
	};

	const deleteService = async () => {
		const current = useClientManager.getState().client;
		if (!current) return;
		setRunningActionID('delete');
		await withCleanup(
			async () => {
				try {
					await current.swarm.deleteService({ serviceId: serviceID, envID: environmentID });
					swarmChanged(environmentID);
					showToast(Toasts.success('Service deleted'));
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setRunningActionID(undefined)
		);
	};

	const editAction: ActionButtonItem = {
		id: 'edit',
		title: 'Edit',
		systemImage: 'slider.horizontal.3',
		tint: accent,
		action: () => {
			if (inspect) swarm.openServiceEditor(environmentID, inspect);
		}
	};
	const primary: ActionButtonItem | undefined = !canManage
		? undefined
		: isReplicated
			? {
					id: 'scale',
					title: 'Scale',
					systemImage: 'plusminus',
					tint: accent,
					action: () => {
						if (summary) swarm.openScale(environmentID, summary);
					}
				}
			: editAction;
	const secondary: ActionButtonItem[] = !canManage
		? []
		: [
				...(isReplicated && inspect ? [editAction] : []),
				{
					id: 'rollback',
					title: 'Rollback',
					systemImage: 'arrow.uturn.backward',
					tint: systemColors.orange,
					confirmationMessage: 'Roll the service back to its previous spec.',
					action: () => void rollback()
				}
			];
	const overflow: ActionButtonItem[] = !canManage
		? []
		: [
				{
					id: 'delete',
					title: 'Delete',
					systemImage: 'trash',
					tint: systemColors.red,
					role: 'destructive',
					confirmationMessage: 'This stops and removes every task of the service.',
					action: () => void deleteService()
				}
			];

	const mode: SwarmServiceMode | undefined =
		draft?.mode ??
		(summary
			? knownModes.includes(summary.mode as SwarmServiceMode)
				? (summary.mode as SwarmServiceMode)
				: 'job'
			: undefined);
	const nodes = inspect?.nodes ?? summary?.nodes;
	const versionIndex = inspect ? swarmVersionIndex(inspect.version) : undefined;
	const created = inspect?.createdAt ?? summary?.createdAt;
	const updated = inspect?.updatedAt ?? summary?.updatedAt;
	const updateState = swarmString(swarmField(inspect?.updateStatus, 'State'));
	const updateMessage = swarmString(swarmField(inspect?.updateStatus, 'Message'));
	const virtualIPs = (swarmArray(swarmField(inspect?.endpoint, 'VirtualIPs')) ?? [])
		.map((entry) => swarmString(swarmField(entry, 'Addr')))
		.filter((v): v is string => v !== undefined);
	const networkDetails = Object.values(inspect?.networkDetails ?? {}).sort((a, b) =>
		a.name < b.name ? -1 : a.name > b.name ? 1 : 0
	);
	const mounts = inspect?.mounts ?? summary?.mounts ?? [];
	const hasConfigRows =
		draft !== undefined &&
		(draft.command !== '' ||
			draft.args !== '' ||
			draft.workingDir !== '' ||
			draft.user !== '' ||
			draft.env.length > 0 ||
			draft.labels.length > 0);

	return {
		environmentID,
		serviceID,
		name,
		summary,
		inspect,
		draft,
		errorMessage,
		load,
		tabs,
		selectedTab,
		setSelectedTab,
		canManage,
		canReadLogs,
		toolbar: {
			primary,
			secondary,
			overflow,
			runningItemID: runningActionID,
			isDisabled: runningActionID !== undefined || !canManage
		},
		image: draft?.image ?? summary?.image ?? '',
		runningText: summary ? `${summary.runningReplicas}/${summary.replicas} running` : undefined,
		summaryHealthy: summary
			? summary.mode !== 'replicated' || summary.runningReplicas >= summary.replicas
			: true,
		modeTitle: mode ? capitalized(mode) : undefined,
		stackName: summary?.stackName,
		nodeCount: nodes && nodes.length > 0 ? nodes.length : undefined,
		versionIndex,
		createdText: created ? swarmDate(created) : undefined,
		updatedText: updated ? swarmDate(updated) : undefined,
		updateState,
		updateMessage,
		hasConfigRows,
		virtualIPs,
		networkDetails,
		summaryNetworks: summary?.networks ?? [],
		mounts,
		mountDescription: (mount: (typeof mounts)[number]) =>
			[mount.type, mount.source, mount.readOnly === true ? 'read-only' : 'read-write']
				.filter((v): v is string => !!v)
				.join(' · '),
		networkDescription: (network: (typeof networkDetails)[number]) =>
			[network.driver, network.scope, network.ingress ? 'ingress' : undefined]
				.filter((v): v is string => v !== undefined)
				.join(' · '),
		openEnv: () => {
			if (draft)
				swarm.openServiceVars(
					environmentID,
					serviceID,
					draft.env.map((pair) => `${pair.key}=${pair.value}`)
				);
		},
		openLabels: () => {
			if (!draft) return;
			const labels: Record<string, string> = {};
			for (const pair of draft.labels) if (!(pair.key in labels)) labels[pair.key] = pair.value;
			swarm.openServiceLabels(environmentID, serviceID, labels);
		}
	};
}

export type SwarmServiceDetailModel = ReturnType<typeof useSwarmServiceDetail>;
