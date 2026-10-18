import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import {
	boundedAPIResponse,
	RemoteDataLimitError,
	RemoteDataLimits
} from '@/core/networking/remote-data-limits';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { NetworkTopology, TopologyNode } from '@/sdk/models/network/Topology';
import { useClientManager } from '@/stores/client-manager';
import { environmentDisplayName, useEnvironmentsStore } from '@/stores/environments-store';
import { showToast, Toasts } from '@/ui/toast';

import { routePayloads, useTabRouter } from './tab-routes';
import { makeTopologyLayout, type TopologyGraphLayout } from './topology-layout';

export type TopologyNodeSheetPayload = { node: TopologyNode; topology: NetworkTopology };

async function fetchTopology(current: ArcaneClient, target: EnvironmentID) {
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
	return response;
}

export function focusedTopology(topology: NetworkTopology, networkID: string | undefined) {
	if (networkID === undefined) return topology;
	const focus = topology.nodes.find(
		(node) => node.type === 'network' && (node.id === networkID || node.id.startsWith(networkID))
	);
	if (!focus) return topology;
	const edges = topology.edges.filter(
		(edge) => edge.source === focus.id || edge.target === focus.id
	);
	const ids = new Set([focus.id, ...edges.flatMap((edge) => [edge.source, edge.target])]);
	return { nodes: topology.nodes.filter((node) => ids.has(node.id)), edges };
}

export function useNetworkTopology({
	environmentID,
	allEnvironments,
	focusNetworkID
}: {
	environmentID: EnvironmentID;
	allEnvironments: boolean;
	focusNetworkID?: string;
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
	const hasTopology = topology !== undefined;
	useLayoutEffect(() => {
		latest.current = { shownEnvironmentID, loadingEnvironmentID, hasTopology };
	});

	const focusRef = useRef(focusNetworkID);
	const loadTopology = useCallback(async (refresh = false) => {
		const target = latest.current.shownEnvironmentID;
		const current = useClientManager.getState().client;
		if (latest.current.loadingEnvironmentID === target || !current) return;
		latest.current.loadingEnvironmentID = target;
		setLoadingEnvironmentID(target);
		if (!latest.current.hasTopology) setErrorMessage(undefined);
		await withCleanup(
			async () => {
				try {
					const response = focusedTopology(await fetchTopology(current, target), focusRef.current);
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
				}
			},
			() => {
				if (latest.current.loadingEnvironmentID === target) {
					latest.current.loadingEnvironmentID = undefined;
					setLoadingEnvironmentID(undefined);
				}
			}
		);
	}, []);

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

export function useTopologyNodePayload() {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => routePayloads.get<TopologyNodeSheetPayload>(token));
	useEffect(() => () => routePayloads.delete(token), [token]);
	return payload;
}
