/**
 * State behind `CreateNetworkView` and `ConnectNetworkContainerSheet`
 * (NetworksView.swift).
 */
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { localizedStandardCompare } from '@/core/list-sort-order';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { containerDisplayName } from '@/features/containers/container-model';

import { networkMembershipChanged, networksChanged } from './network-actions';
import { routePayloads } from './tab-routes';

export const networkDrivers = [
	{ label: 'Bridge', value: 'bridge' },
	{ label: 'Host', value: 'host' },
	{ label: 'Overlay', value: 'overlay' },
	{ label: 'Macvlan', value: 'macvlan' },
	{ label: 'None', value: 'none' }
];

function useDismiss() {
	const router = useRouter();
	return () => {
		if (router.canGoBack()) router.back();
	};
}

export function useCreateNetwork(environmentID: EnvironmentID) {
	const dismiss = useDismiss();
	const [name, setName] = useState('');
	const [driver, setDriver] = useState('bridge');
	const [isInternal, setIsInternal] = useState(false);
	const [subnet, setSubnet] = useState('');
	const [gateway, setGateway] = useState('');
	const [ipRange, setIPRange] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const createNetwork = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		try {
			const body: Record<string, unknown> = { name, driver, internal: isInternal };
			const trimmedSubnet = subnet.trim();
			const trimmedGateway = gateway.trim();
			const trimmedRange = ipRange.trim();
			if (trimmedSubnet !== '' || trimmedGateway !== '' || trimmedRange !== '') {
				const config: Record<string, string> = {};
				if (trimmedSubnet !== '') config.subnet = trimmedSubnet;
				if (trimmedGateway !== '') config.gateway = trimmedGateway;
				if (trimmedRange !== '') config.ipRange = trimmedRange;
				body.ipam = { config: [config] };
			}
			await client.rest.post<unknown>(client.rest.environmentPath(environmentID, 'networks'), {
				body
			});
			networksChanged(environmentID);
			showToast(Toasts.success('Network created'));
			dismiss();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsLoading(false);
		}
	};

	return {
		name,
		setName,
		driver,
		setDriver,
		isInternal,
		setIsInternal,
		subnet,
		setSubnet,
		gateway,
		setGateway,
		ipRange,
		setIPRange,
		errorMessage,
		canCreate: name !== '' && !isLoading,
		footer: isInternal
			? 'Internal networks block external connectivity for attached containers.'
			: 'Bridge is the standard single-host Docker network driver.',
		cancel: dismiss,
		create: () => void createNetwork()
	};
}

/** Route payload for the Connect sheet. */
export type ConnectSheetPayload = {
	excludedContainerIDs: Set<string>;
	onConnected: () => Promise<void> | void;
};

export function useConnectNetworkContainer(args: {
	environmentID: EnvironmentID;
	networkID: string;
	token?: string;
}) {
	const { environmentID, networkID, token } = args;
	const dismiss = useDismiss();
	const [payload] = useState(() => routePayloads.get<ConnectSheetPayload>(token));
	useEffect(() => () => routePayloads.delete(token), [token]);
	const [containers, setContainers] = useState<ContainerSummary[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [selectedID, setSelectedID] = useState<string>();
	const [aliases, setAliases] = useState('');
	const [ipv4, setIPv4] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	useEffect(() => {
		const client = useClientManager.getState().client;
		const cached = cachedClient();
		if (!client || !cached) return;
		let cancelled = false;
		setIsLoading(true);
		void cached
			.getAllPages<ContainerSummary>(
				client.rest.environmentPath(environmentID, 'containers'),
				environmentID,
				async (start, limit) => {
					const response = await client.containers.list({
						envID: environmentID,
						query: { start, limit }
					});
					return { items: response.data, pagination: response.pagination };
				}
			)
			.then((items) => {
				if (!cancelled) setContainers(items);
			})
			.catch((error: unknown) => {
				if (!cancelled) setErrorMessage(friendlyErrorMessage(error));
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [environmentID]);

	const candidates = useMemo(() => {
		const excluded = payload?.excludedContainerIDs ?? new Set<string>();
		return containers
			.filter((container) => !excluded.has(container.id))
			.sort((a, b) => localizedStandardCompare(containerDisplayName(a), containerDisplayName(b)));
	}, [containers, payload]);

	const connect = async () => {
		const client = useClientManager.getState().client;
		if (!client || selectedID === undefined) return;
		setIsSubmitting(true);
		setErrorMessage(undefined);
		const aliasList = aliases
			.split(',')
			.map((alias) => alias.trim())
			.filter((alias) => alias !== '');
		const address = ipv4.trim();
		try {
			await client.rest.postVoid(
				client.rest.environmentPath(environmentID, `networks/${networkID}/connect`),
				{
					body: {
						containerId: selectedID,
						aliases: aliasList.length === 0 ? undefined : aliasList,
						ipv4Address: address === '' ? undefined : address
					}
				}
			);
			showToast(Toasts.success('Container connected'));
			networkMembershipChanged(environmentID);
			await payload?.onConnected();
			dismiss();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsSubmitting(false);
		}
	};

	return {
		containers,
		candidates,
		isLoading,
		selectedID,
		setSelectedID,
		aliases,
		setAliases,
		ipv4,
		setIPv4,
		isSubmitting,
		errorMessage,
		canConnect: selectedID !== undefined && !isSubmitting,
		cancel: dismiss,
		connect: () => void connect()
	};
}
