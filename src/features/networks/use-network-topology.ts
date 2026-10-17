/** State behind `NetworkTopologyView` (NetworkTopologyView.swift). */
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import {
	boundedAPIResponse,
	RemoteDataLimitError,
	RemoteDataLimits
} from '@/core/networking/remote-data-limits';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { NetworkTopology, TopologyNode } from '@/sdk/models/network/Topology';
import { useClientManager } from '@/stores/client-manager';
import { environmentDisplayName, useEnvironmentsStore } from '@/stores/environments-store';
import { showToast, Toasts } from '@/ui/toast';

import { routePayloads, useTabRouter } from './tab-routes';
import { makeTopologyLayout, type TopologyGraphLayout } from './topology-layout';

export type TopologyNodeSheetPayload = { node: TopologyNode; topology: NetworkTopology };

export function useNetworkTopology({
	environmentID,
	allEnvironments
}: {
	environmentID: EnvironmentID;
	allEnvironments: boolean;
}) {
	const nav = useTabRouter();
	const client = useClientManager((s) => s.client);
	const environments = useEnvironmentsStore((s) => s.environments);
	const [topology, setTopology] = useState<NetworkTopology>();
	const [layout, setLayout] = useState<TopologyGraphLayout>();
	const [layoutRevision, setLayoutRevision] = useState(0);
	const [loadingEnvironmentID, setLoadingEnvironmentID] = useState<EnvironmentID>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const [chosenEnvironmentID, setChosenEnvironmentID] = useState<EnvironmentID>();

	const shownEnvironmentID = allEnvironments
		? (chosenEnvironmentID ?? environmentID)
		: environmentID;
	const latest = useRef({ shownEnvironmentID, loadingEnvironmentID, hasTopology: false });
	latest.current = {
		shownEnvironmentID,
		loadingEnvironmentID,
		hasTopology: topology !== undefined
	};

	const loadTopology = useCallback(async (refresh = false) => {
		const target = latest.current.shownEnvironmentID;
		const current = useClientManager.getState().client;
		if (latest.current.loadingEnvironmentID === target || !current) return;
		latest.current.loadingEnvironmentID = target;
		setLoadingEnvironmentID(target);
		if (!latest.current.hasTopology) setErrorMessage(undefined);
		try {
			const response = await boundedAPIResponse<NetworkTopology>(
				current,
				current.rest.environmentPath(target, 'networks/topology')
			);
			if (
				response.nodes.length > RemoteDataLimits.maximumTopologyNodes ||
				response.edges.length > RemoteDataLimits.maximumTopologyEdges
			) {
				throw RemoteDataLimitError.collectionTooLarge(RemoteDataLimits.maximumTopologyEdges);
			}
			// The environment choice changed while this load was in flight.
			if (target !== latest.current.shownEnvironmentID) return;
			setTopology(response);
			setLayout(makeTopologyLayout(response));
			setLayoutRevision((r) => r + 1);
			setErrorMessage(undefined);
		} catch (error) {
			if (target !== latest.current.shownEnvironmentID) return;
			const message = friendlyErrorMessage(error);
			if (!latest.current.hasTopology) setErrorMessage(message);
			else if (refresh) showToast(Toasts.error(message));
		} finally {
			if (latest.current.loadingEnvironmentID === target) {
				latest.current.loadingEnvironmentID = undefined;
				setLoadingEnvironmentID(undefined);
			}
		}
	}, []);

	// `.task(id: loadKey)`: the client and the shown environment.
	useEffect(() => {
		void loadTopology();
	}, [client, shownEnvironmentID, loadTopology]);

	useEffect(() => {
		if (allEnvironments) void useEnvironmentsStore.getState().load();
	}, [allEnvironments]);

	const selectEnvironment = (id: EnvironmentID) => {
		if (id === shownEnvironmentID) return;
		setChosenEnvironmentID(id);
		setTopology(undefined);
		setLayout(undefined);
		setErrorMessage(undefined);
		latest.current.hasTopology = false;
	};

	const enabledEnvironments = environments
		.filter((e) => e.enabled)
		.map((e) => ({ id: e.id, title: environmentDisplayName(e) }));

	return {
		hasClient: client !== undefined,
		topology,
		layout,
		layoutRevision,
		isLoading: loadingEnvironmentID !== undefined,
		errorMessage,
		allEnvironments,
		shownEnvironmentID,
		enabledEnvironments,
		selectEnvironment,
		loadTopology,
		selectNode: (node: TopologyNode) => {
			if (!topology) return;
			const payload: TopologyNodeSheetPayload = { node, topology };
			nav.push('topology-node', { token: routePayloads.put(payload) });
		}
	};
}

export type NetworkTopologyModel = ReturnType<typeof useNetworkTopology>;

/** The sheet's `(node, topology)` handed over by the diagram. */
export function useTopologyNodePayload() {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => routePayloads.get<TopologyNodeSheetPayload>(token));
	useEffect(() => () => routePayloads.delete(token), [token]);
	return payload;
}
