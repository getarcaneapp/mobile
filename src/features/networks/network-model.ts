import { formattedISO8601 } from '@/core/date-formatting';
import { ListSortOrder } from '@/core/list-sort-order';
import type { JSONValue } from '@/sdk/types/json';
import type { NetworkContainerEndpoint, NetworkSummary } from '@/sdk/models/network/Network';
import type { EnvironmentItem } from '@/stores/environment-paged-list';
import { systemColors } from '@/theme/colors';
import type { PreviewBadge, PreviewDetail } from '@/ui/components/row-preview-card.types';
import type { ResourceMetadataItem } from '@/ui/components/resource-detail.types';

export type NetworkItem = EnvironmentItem<NetworkSummary>;

export type NetworkTypeFilter = 'All' | 'Standard' | 'Internal';
export const NetworkTypeFilters: NetworkTypeFilter[] = ['All', 'Standard', 'Internal'];

export const networkIsInternal = (_network: NetworkSummary) => false;
export const networkContainerCount = (_network: NetworkSummary) => 0;

const systemNetworkNames = new Set(['host', 'bridge', 'none']);

export const isSystemNetworkName = (name: string) => systemNetworkNames.has(name.toLowerCase());

export const allowsConnect = (name: string) => !['host', 'none'].includes(name.toLowerCase());

const contains = (value: string, query: string) =>
	value.toLocaleLowerCase().includes(query.toLocaleLowerCase());

export function partitionNetworks(
	networks: NetworkItem[],
	options: {
		search: string;
		environmentFilter?: string;
		typeFilter: NetworkTypeFilter;
		sortOrder: ListSortOrder;
	}
): { system: NetworkItem[]; user: NetworkItem[] } {
	const { search, environmentFilter, typeFilter, sortOrder } = options;
	const filtered = networks
		.filter((network) => {
			if (environmentFilter !== undefined && network.environmentID !== environmentFilter)
				return false;
			const matchesSearch =
				search === '' ||
				contains(network.value.name, search) ||
				contains(network.value.driver, search);
			const internal = networkIsInternal(network.value);
			const matchesType =
				typeFilter === 'All' ||
				(typeFilter === 'Standard' && !internal) ||
				(typeFilter === 'Internal' && internal);
			return matchesSearch && matchesType;
		})
		.sort((a, b) => ListSortOrder.compare(sortOrder, a.value.name, b.value.name));
	const system: NetworkItem[] = [];
	const user: NetworkItem[] = [];
	for (const network of filtered) {
		if (isSystemNetworkName(network.value.name)) system.push(network);
		else user.push(network);
	}
	return { system, user };
}

const capitalized = (value: string) =>
	value
		.toLowerCase()
		.replace(/(^|\s)(\S)/g, (_m, space: string, c: string) => space + c.toUpperCase());

export { capitalized };

export function networkDriverName(driver: string | undefined) {
	const value = (driver ?? '').trim();
	return value === '' || value.toLowerCase() === 'null' ? 'None' : value;
}

export function networkPreview(network: NetworkItem): {
	title: string;
	badges: PreviewBadge[];
	details: PreviewDetail[];
} {
	const value = network.value;
	const badges: PreviewBadge[] = [
		{ text: capitalized(networkDriverName(value.driver)), color: systemColors.teal }
	];
	if (networkIsInternal(value)) badges.push({ text: 'Internal', color: systemColors.orange });
	const details: PreviewDetail[] = [
		{ icon: 'globe', label: 'Scope', value: capitalized(value.scope) }
	];
	const count = networkContainerCount(value);
	if (count > 0)
		details.unshift({ icon: 'shippingbox', label: 'Connected Containers', value: String(count) });
	details.push({ icon: 'number', label: 'ID', value: value.id, monospaced: true });
	if (network.environmentName)
		details.push({ icon: 'server.rack', label: 'Environment', value: network.environmentName });
	return { title: value.name === '' ? value.id : value.name, badges, details };
}

export function networkMetadata(network: NetworkSummary): ResourceMetadataItem[] {
	return [
		{ label: 'Driver', value: networkDriverName(network.driver), systemImage: 'gearshape' },
		{ label: 'Scope', value: capitalized(network.scope), systemImage: 'scope' },
		{
			label: 'Created',
			value: formattedISO8601(network.created, 'abbreviated', 'shortened'),
			systemImage: 'calendar'
		},
		{
			label: 'Status',
			value: network.inUse ? 'In use' : 'Unused',
			systemImage: 'circle.fill',
			tint: network.inUse ? systemColors.green : undefined
		}
	];
}

export type NetworkContainerRowData = { id: string; name?: string; ipv4?: string; ipv6?: string };

export function containerRowDisplayName(row: NetworkContainerRowData) {
	const trimmed = (row.name ?? '').replace(/^[/ ]+|[/ ]+$/g, '');
	return trimmed === '' ? row.id.slice(0, 12) : trimmed;
}

export function containerRowDisplayIP(row: NetworkContainerRowData) {
	if (row.ipv4) return row.ipv4;
	if (row.ipv6) return row.ipv6;
	return '—';
}

const stringValue = (value: JSONValue | undefined) =>
	typeof value === 'string' ? value : undefined;

export function connectedContainerRows(
	endpoints: NetworkContainerEndpoint[],
	raw: Record<string, JSONValue>
): NetworkContainerRowData[] {
	if (endpoints.length > 0) {
		return endpoints.map((endpoint) => ({
			id: endpoint.id,
			name: endpoint.name,
			ipv4: endpoint.ipv4Address,
			ipv6: endpoint.ipv6Address
		}));
	}
	const rows: NetworkContainerRowData[] = [];
	for (const key of Object.keys(raw).sort()) {
		const value = raw[key];
		if (value === null || typeof value !== 'object' || Array.isArray(value)) continue;
		rows.push({
			id: key,
			name: stringValue(value.Name) ?? '',
			ipv4: stringValue(value.IPv4Address) ?? '',
			ipv6: stringValue(value.IPv6Address) ?? ''
		});
	}
	return rows;
}

export function ipamRows(
	ipam:
		| { driver?: string; config?: { subnet?: string; gateway?: string; ipRange?: string }[] }
		| undefined
) {
	if (!ipam) return undefined;
	const hasDriver = (ipam.driver ?? '') !== '';
	const configs = ipam.config ?? [];
	if (!hasDriver && configs.length === 0) return undefined;
	const rows: { id: string; label: string; value: string }[] = [];
	configs.forEach((config, offset) => {
		const id = `${config.subnet ?? ''}|${config.gateway ?? ''}|${config.ipRange ?? ''}#${offset}`;
		if (config.subnet) rows.push({ id: `${id}.subnet`, label: 'Subnet', value: config.subnet });
		if (config.gateway) rows.push({ id: `${id}.gateway`, label: 'Gateway', value: config.gateway });
		if (config.ipRange) rows.push({ id: `${id}.range`, label: 'IP Range', value: config.ipRange });
	});
	return rows;
}

export const sortedPairs = (pairs: Record<string, string>) =>
	Object.keys(pairs)
		.sort()
		.map((key) => ({ key, value: pairs[key] ?? '' }));

export const titled = (title: string, count?: number) =>
	count === undefined ? title : `${title} (${count})`;
