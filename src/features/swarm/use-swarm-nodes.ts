import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import { Permission } from '@/sdk/models/role/Permission';
import type { SwarmNode } from '@/sdk/models/swarm/SwarmNode';
import { useClientManager } from '@/stores/client-manager';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { useDebounced, useOnChange } from '@/features/containers/hooks';
import { screenCache } from '@/features/networks/tab-routes';

import {
	capitalized,
	nodeIsLeader,
	nodeIsManager,
	swarmChanged,
	swarmDate,
	useCan,
	useSwarmVersion
} from './swarm-common';
import { swarmKeys, useSwarmNavigation } from './swarm-routes';
import { useSwarmPagedList } from './use-swarm-list';

export type SwarmNodeAction =
	| { kind: 'promote' }
	| { kind: 'demote' }
	| { kind: 'availability'; value: string };

export function nodeActionSuccessTitle(action: SwarmNodeAction) {
	switch (action.kind) {
		case 'promote':
			return 'Node promoted';
		case 'demote':
			return 'Node demoted';
		case 'availability':
			return `Node set to ${action.value}`;
	}
}

async function performNodeAction(
	action: SwarmNodeAction,
	node: SwarmNode,
	environmentID: EnvironmentID
) {
	const client = useClientManager.getState().client;
	if (!client) return false;
	switch (action.kind) {
		case 'promote':
			await client.swarm.promoteNode({ nodeId: node.id, envID: environmentID });
			break;
		case 'demote':
			await client.swarm.demoteNode({ nodeId: node.id, envID: environmentID });
			break;
		case 'availability':
			await client.swarm.updateNode({
				nodeId: node.id,
				request: { availability: action.value },
				envID: environmentID
			});
			break;
	}
	return true;
}

export const availabilityValues = ['active', 'pause', 'drain'] as const;

export const nodeSubtitle = (node: SwarmNode) =>
	[nodeIsLeader(node) ? 'Leader' : capitalized(node.role), node.address, node.engineVersion]
		.filter((v): v is string => !!v)
		.join(' · ');

export const nodeRoleTitle = (node: SwarmNode) =>
	nodeIsLeader(node) ? 'Leader' : capitalized(node.role);

export function useSwarmNodes(environmentID: EnvironmentID) {
	const swarm = useSwarmNavigation();
	const can = useCan(environmentID);
	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);
	const [pendingRemove, setPendingRemove] = useState<SwarmNode>();
	const paged = useSwarmPagedList<SwarmNode>(
		environmentID,
		(client, { envID, search, start, limit }) =>
			client.swarm.listNodes({ envID, search, start, limit }),
		debouncedSearch
	);
	const canManage = can(Permission.Swarm.nodes);

	const run = async (action: SwarmNodeAction, node: SwarmNode) => {
		try {
			if (!(await performNodeAction(action, node, environmentID))) return;
			swarmChanged(environmentID);
			showToast(Toasts.success(nodeActionSuccessTitle(action)));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	const remove = async (node: SwarmNode) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			await client.swarm.deleteNode({ nodeId: node.id, force: true, envID: environmentID });
			paged.list.updateItems((items) => items.filter((item) => item.value.id !== node.id));
			swarmChanged(environmentID);
			showToast(Toasts.success('Node removed'));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	useItemDeleteConfirmation(pendingRemove, setPendingRemove, (node) => ({
		title: 'Remove Node',
		message: `Force-remove “${node.hostname}” from the swarm? Its tasks are rescheduled elsewhere.`,
		icon: 'trash',
		actions: [{ title: 'Remove', action: () => void remove(node) }],
		dismissOnConfirm: false
	}));

	return {
		...paged,
		environmentID,
		setSearchText,
		canManage,
		emptyTitle: debouncedSearch === '' ? 'No Nodes' : 'No Results',
		openDetail: (node: SwarmNode) => swarm.openNode(environmentID, node),
		run: (action: SwarmNodeAction, node: SwarmNode) => void run(action, node),
		requestRemove: (node: SwarmNode) => setPendingRemove(node)
	};
}

export type SwarmNodesModel = ReturnType<typeof useSwarmNodes>;

export function useSwarmNodeDetail() {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const environmentID = envID;
	const swarm = useSwarmNavigation();
	const accent = useAccentColor();
	const can = useCan(environmentID);
	const [node, setNode] = useState<SwarmNode | undefined>(() =>
		screenCache.get<SwarmNode>(swarmKeys.node(environmentID, id))
	);
	const [showAddLabel, setShowAddLabel] = useState(false);
	const [newLabelKey, setNewLabelKey] = useState('');
	const [newLabelValue, setNewLabelValue] = useState('');
	const [runningActionID, setRunningActionID] = useState<string>();
	const canManage = can(Permission.Swarm.nodes);

	const reload = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const fresh = await client.swarm
			.node({ nodeId: id, envID: environmentID })
			.catch(() => undefined);
		if (fresh) setNode(fresh);
	}, [id, environmentID]);

	useOnChange(useSwarmVersion(environmentID), () => void reload());

	const run = async (action: SwarmNodeAction, actionID: string) => {
		if (!node) return;
		setRunningActionID(actionID);
		await withCleanup(
			async () => {
				try {
					if (!(await performNodeAction(action, node, environmentID))) return;
					swarmChanged(environmentID);
					showToast(Toasts.success(nodeActionSuccessTitle(action)));
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setRunningActionID(undefined)
		);
	};

	const saveLabels = async (labels: Record<string, string>) => {
		const client = useClientManager.getState().client;
		if (!client || !node) return;
		try {
			await client.swarm.updateNode({ nodeId: node.id, request: { labels }, envID: environmentID });
			swarmChanged(environmentID);
			showToast(Toasts.success('Labels updated'));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	const remove = async () => {
		const client = useClientManager.getState().client;
		if (!client || !node) return;
		setRunningActionID('remove');
		await withCleanup(
			async () => {
				try {
					await client.swarm.deleteNode({ nodeId: node.id, force: true, envID: environmentID });
					swarmChanged(environmentID);
					showToast(Toasts.success('Node removed'));
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setRunningActionID(undefined)
		);
	};

	const isManager = node ? nodeIsManager(node) : false;
	const roleAction: ActionButtonItem = isManager
		? {
				id: 'demote',
				title: 'Demote',
				systemImage: 'arrow.down.circle',
				tint: systemColors.orange,
				confirmationMessage: 'Demote this manager to a worker.',
				action: () => void run({ kind: 'demote' }, 'demote')
			}
		: {
				id: 'promote',
				title: 'Promote',
				systemImage: 'arrow.up.circle',
				tint: accent,
				action: () => void run({ kind: 'promote' }, 'promote')
			};

	const availabilityActions: ActionButtonItem[] = (
		[
			['active', 'play.circle'],
			['pause', 'pause.circle'],
			['drain', 'arrow.down.to.line.circle']
		] as const
	)
		.filter(([value]) => value !== node?.availability.toLowerCase())
		.map(([value, image]) => ({
			id: value,
			title: value === 'active' ? 'Activate' : capitalized(value),
			systemImage: image,
			tint: value === 'drain' ? systemColors.orange : accent,
			action: () => void run({ kind: 'availability', value }, value)
		}));

	const removeAction: ActionButtonItem = {
		id: 'remove',
		title: 'Remove',
		systemImage: 'trash',
		tint: systemColors.red,
		role: 'destructive',
		confirmationMessage:
			'Force-remove this node from the swarm. Its tasks are rescheduled elsewhere.',
		action: () => void remove()
	};

	const labels = Object.entries(node?.labels ?? {}).sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0
	);

	return {
		environmentID,
		node,
		canManage,
		reload,
		labels,
		agentHeartbeat: node?.agent.lastHeartbeat ? swarmDate(node.agent.lastHeartbeat) : undefined,
		toolbar: {
			primary: canManage ? roleAction : undefined,
			secondary: canManage ? availabilityActions : [],
			overflow: canManage ? [removeAction] : [],
			runningItemID: runningActionID,
			isDisabled: runningActionID !== undefined
		},
		openTasks: () => {
			if (node)
				swarm.openTasks(environmentID, { kind: 'node', id: node.id }, `Tasks on ${node.hostname}`);
		},
		removeLabel: (key: string) => {
			const updated = { ...node?.labels };
			delete updated[key];
			void saveLabels(updated);
		},
		showAddLabel,
		setShowAddLabel,
		newLabelKey,
		setNewLabelKey,
		newLabelValue,
		setNewLabelValue,
		beginAddLabel: () => {
			setNewLabelKey('');
			setNewLabelValue('');
			setShowAddLabel(true);
		},
		commitAddLabel: () => {
			setShowAddLabel(false);
			const key = newLabelKey.trim();
			if (key === '') return;
			void saveLabels({ ...node?.labels, [key]: newLabelValue });
		}
	};
}

export type SwarmNodeDetailModel = ReturnType<typeof useSwarmNodeDetail>;
