import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { localizedStandardCompare } from '@/core/list-sort-order';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { PortMapping } from '@/sdk/models/port/PortMapping';
import { useClientManager } from '@/stores/client-manager';
import {
	useEnvironmentPagedList,
	type EnvironmentFetch,
	type EnvironmentItem
} from '@/stores/environment-paged-list';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { systemColors } from '@/theme/colors';

import { useDebounced, useOnChange } from '@/features/containers/hooks';
import { screenCache, useTabRouter } from '@/features/networks/tab-routes';

const pageSize = 50;

export type PortItem = EnvironmentItem<PortMapping>;

export type PortGroup = {
	id: string;
	container: string;
	environmentID: EnvironmentID;
	environmentName?: string;
	ports: PortItem[];
};

export function displayHostIP(value: string | undefined) {
	const trimmed = (value ?? '').trim();
	if (trimmed === '' || trimmed.toLowerCase() === 'invalid ip') return '0.0.0.0';
	return trimmed;
}

export function hostString(port: PortMapping) {
	const ip = displayHostIP(port.hostIp);
	return port.hostPort === undefined ? ip : `${ip}:${port.hostPort}`;
}

export function protocolTint(port: PortMapping) {
	switch (port.protocolName.toLowerCase()) {
		case 'tcp':
			return systemColors.blue;
		case 'udp':
			return systemColors.purple;
		case 'sctp':
			return systemColors.pink;
		default:
			return systemColors.gray;
	}
}

function filteredPorts(ports: PortItem[], query: string) {
	const trimmed = query.trim();
	if (trimmed === '') return ports;
	const lower = trimmed.toLocaleLowerCase();
	const has = (value: string) => value.toLocaleLowerCase().includes(lower);
	return ports.filter(
		({ value: port }) =>
			has(port.containerName) ||
			has(port.protocolName) ||
			String(port.containerPort).includes(trimmed) ||
			(port.hostPort === undefined ? '' : String(port.hostPort)).includes(trimmed) ||
			has(displayHostIP(port.hostIp))
	);
}

export function portGroups(ports: PortItem[], query: string): PortGroup[] {
	const groups = new Map<string, PortItem[]>();
	for (const port of filteredPorts(ports, query)) {
		const key = `${port.environmentID}\u0000${port.value.containerName}`;
		const group = groups.get(key) ?? [];
		group.push(port);
		groups.set(key, group);
	}
	return [...groups.values()]
		.map((items) => {
			const first = items[0]!;
			return {
				id:
					first.environmentName === undefined
						? first.value.containerName
						: `${first.environmentID}/${first.value.containerName}`,
				container: first.value.containerName,
				environmentID: first.environmentID,
				environmentName: first.environmentName,
				ports: [...items].sort((lhs, rhs) => {
					const lhsHost = lhs.value.hostPort ?? Number.MAX_SAFE_INTEGER;
					const rhsHost = rhs.value.hostPort ?? Number.MAX_SAFE_INTEGER;
					if (lhsHost !== rhsHost) return lhsHost - rhsHost;
					return lhs.value.containerPort - rhs.value.containerPort;
				})
			};
		})
		.sort((a, b) => {
			const order = localizedStandardCompare(a.container, b.container);
			if (order !== 0) return order;
			return localizedStandardCompare(a.environmentName ?? '', b.environmentName ?? '');
		});
}

export const portCacheKey = (environmentID: EnvironmentID, id: string) =>
	`port:${environmentID}/${id}`;

export type PortsListProps = { environmentID: EnvironmentID; allEnvironments?: boolean };

export function usePortsList({ environmentID, allEnvironments = false }: PortsListProps) {
	const nav = useTabRouter();
	const client = useClientManager((s) => s.client);
	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);
	const [list, snapshot] = useEnvironmentPagedList<PortMapping>(pageSize);
	const ports = snapshot.items;

	const searchRef = useRef(debouncedSearch);
	searchRef.current = debouncedSearch;

	const portsPage = useCallback((): EnvironmentFetch<PortMapping> | undefined => {
		const current = useClientManager.getState().client;
		if (!current) return undefined;
		const search = searchRef.current === '' ? undefined : searchRef.current;
		return async (envID, start, limit) => {
			const response = await current.ports.list({ envID, query: { search, start, limit } });
			return { items: response.data, pagination: response.pagination };
		};
	}, []);

	const load = useCallback(
		async (preservingLoadedRange = false) => {
			const fetch = portsPage();
			if (!fetch) return;
			const environments = await useEnvironmentsStore
				.getState()
				.listEnvironments(environmentID, allEnvironments);
			await list.reload(environments, fetch, { preservingLoadedRange });
		},
		[portsPage, list, environmentID, allEnvironments]
	);

	const loadMore = useCallback(async () => {
		const fetch = portsPage();
		if (fetch) await list.loadMore(fetch);
	}, [portsPage, list]);

	useFocusEffect(
		useCallback(() => {
			void load(true);
		}, [load])
	);
	useOnChange(debouncedSearch, () => void load());
	useOnChange(client, () => void load());

	const sections = useMemo(() => portGroups(ports, debouncedSearch), [ports, debouncedSearch]);

	return {
		snapshot,
		ports,
		sections,
		setSearchText,
		load,
		loadMore,
		refresh: () => load(),
		openDetail: (port: PortItem) => {
			screenCache.set(portCacheKey(port.environmentID, port.value.id), port.value);
			nav.push(`port/${encodeURIComponent(port.value.id)}`, { envID: port.environmentID });
		}
	};
}

export type PortsListModel = ReturnType<typeof usePortsList>;
