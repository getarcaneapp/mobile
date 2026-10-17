import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import { NetworkInspect, NetworkSummary } from '@/sdk/models/network/Network';
import { useClientManager } from '@/stores/client-manager';
import {
	useDeleteConfirmation,
	useItemDeleteConfirmation
} from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { deleteNetworkRequest, networkMembershipChanged, networksChanged } from './network-actions';
import {
	allowsConnect,
	connectedContainerRows,
	containerRowDisplayName,
	isSystemNetworkName,
	type NetworkContainerRowData
} from './network-model';
import { networkCacheKey, showActionFailed } from './use-networks-list';
import { routePayloads, screenCache, useTabRouter } from './tab-routes';
import type { ConnectSheetPayload } from './use-network-sheets';

type DisconnectTarget = { id: string; name: string };

export function useNetworkDetail() {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const environmentID = envID;
	const nav = useTabRouter();
	const client = useClientManager((s) => s.client);
	useClientManager((s) => s.accessGeneration);

	const [inspect, setInspect] = useState<NetworkInspect>();
	const [isLoadingInspect, setIsLoadingInspect] = useState(false);
	const [inspectError, setInspectError] = useState<string>();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [pendingDisconnect, setPendingDisconnect] = useState<DisconnectTarget>();

	const network: NetworkSummary = useMemo(() => {
		const cached = screenCache.get<NetworkSummary>(networkCacheKey(environmentID, id));
		if (cached) return cached;
		return NetworkSummary.make({
			id,
			name: inspect?.name ?? '',
			driver: inspect?.driver ?? '',
			scope: inspect?.scope ?? '',
			created: inspect?.created ?? '',
			labels: inspect?.labels,
			options: inspect?.options
		});
	}, [environmentID, id, inspect]);

	const isBuiltIn = isSystemNetworkName(network.name);
	const canConnect =
		allowsConnect(network.name) && hasPermission('networks:connect', environmentID);
	const canDisconnect = hasPermission('networks:disconnect', environmentID);

	const loadInspect = useCallback(async () => {
		const current = useClientManager.getState().client;
		if (!current) return;
		setIsLoadingInspect(true);
		try {
			const result = await current.rest.get<NetworkInspect>(
				current.rest.environmentPath(environmentID, `networks/${id}`),
				{
					decode: NetworkInspect.decode
				}
			);
			setInspect(result);
			setInspectError(undefined);
		} catch (error) {
			setInspectError(friendlyErrorMessage(error));
		} finally {
			setIsLoadingInspect(false);
		}
	}, [environmentID, id]);

	useEffect(() => {
		void loadInspect();
	}, [loadInspect, client]);

	const connectedRows: NetworkContainerRowData[] = inspect
		? connectedContainerRows(inspect.containersList, inspect.containers)
		: [];

	const connectedContainerIDs = useMemo(() => {
		const ids = new Set(inspect?.containersList.map((c) => c.id) ?? []);
		for (const key of Object.keys(inspect?.containers ?? {})) ids.add(key);
		return ids;
	}, [inspect]);

	const membershipChanged = useCallback(async () => {
		networkMembershipChanged(environmentID);
		await loadInspect();
	}, [environmentID, loadInspect]);

	const disconnect = async (target: DisconnectTarget) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			await current.rest.postVoid(
				current.rest.environmentPath(environmentID, `networks/${id}/disconnect`),
				{
					body: { containerId: target.id }
				}
			);
			await membershipChanged();
			showToast(Toasts.success('Container disconnected'));
		} catch (error) {
			showActionFailed(friendlyErrorMessage(error), 'Error');
		}
	};

	const deleteNetwork = async () => {
		try {
			if (!(await deleteNetworkRequest(environmentID, id))) return;
			networksChanged(environmentID);
			showToast(Toasts.success('Network deleted'));
			nav.back();
		} catch (error) {
			showActionFailed(friendlyErrorMessage(error), 'Error');
		}
	};

	useItemDeleteConfirmation(pendingDisconnect, setPendingDisconnect, (target) => ({
		title: 'Disconnect Container',
		message: `Disconnect “${target.name}” from ${network.name}?`,
		icon: 'link',
		actions: [{ title: 'Disconnect', action: () => void disconnect(target) }],
		dismissOnConfirm: false
	}));

	useDeleteConfirmation(showDeleteConfirm, setShowDeleteConfirm, {
		title: 'Delete Network',
		message: `Delete “${network.name}”? This cannot be undone.`,
		icon: 'trash',
		actions: [{ title: 'Delete', action: () => void deleteNetwork() }],
		dismissOnConfirm: false
	});

	return {
		environmentID,
		network,
		inspect,
		isLoadingInspect,
		inspectError,
		isBuiltIn,
		canConnect,
		canDisconnect,
		connectedRows,
		title: network.name === '' ? network.id : network.name,
		loadInspect,
		requestDelete: () => setShowDeleteConfirm(true),
		requestDisconnect: (row: NetworkContainerRowData) =>
			setPendingDisconnect({ id: row.id, name: containerRowDisplayName(row) }),
		openTopology: () => nav.push('networkTopology', { envID: environmentID, scoped: '1' }),
		openConnect: () => {
			const payload: ConnectSheetPayload = {
				excludedContainerIDs: connectedContainerIDs,
				onConnected: () => loadInspect()
			};
			nav.push(`network/${encodeURIComponent(id)}/connect`, {
				envID: environmentID,
				name: network.name,
				token: routePayloads.put(payload)
			});
		}
	};
}

export type NetworkDetailModel = ReturnType<typeof useNetworkDetail>;
