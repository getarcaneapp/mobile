import type { TopologyNode } from '@/sdk/models/network/Topology';
import { systemColors } from '@/theme/colors';

import type { TopologyConnection } from './topology-graph';

export * from './topology-graph';

const capitalized = (value: string) =>
	value
		.toLowerCase()
		.replace(/(^|\s)(\S)/g, (_m, space: string, c: string) => space + c.toUpperCase());

export function nodeAccent(node: TopologyNode): string | undefined {
	if (node.type === 'network') return systemColors.teal;
	switch (node.metadata.status?.toLowerCase()) {
		case 'running':
			return systemColors.green;
		case 'paused':
			return systemColors.orange;
		case 'exited':
		case 'dead':
			return systemColors.red;
		default:
			return undefined;
	}
}

export function nodeAddressLines(node: TopologyNode, connections: TopologyConnection[]): string[] {
	if (node.type === 'network') return [];
	const multiple = connections.length > 1;
	const lines: string[] = [];
	for (const connection of connections) {
		const addresses = [connection.ipv4Address, connection.ipv6Address].filter(
			(v): v is string => !!v
		);
		if (addresses.length === 0) continue;
		const address = addresses.join(' | ');
		lines.push(multiple ? `${connection.otherNode.name}: ${address}` : address);
	}
	return lines;
}

export const networkSummary = (node: TopologyNode) =>
	[node.metadata.driver, node.metadata.scope]
		.filter((v): v is string => !!v)
		.map(capitalized)
		.join(' · ');

export const nodeTitle = (node: TopologyNode) => (node.name === '' ? node.id : node.name);

export function nodeAccessibilityDescription(
	node: TopologyNode,
	connections: TopologyConnection[]
) {
	const parts = [node.type === 'network' ? 'Network' : 'Container', nodeTitle(node)];
	if (node.type === 'network') {
		const summary = networkSummary(node);
		if (summary !== '') parts.push(summary);
		if (node.metadata.isDefault === true) parts.push('Default network');
	} else {
		if (node.metadata.status) parts.push(node.metadata.status);
		parts.push(...nodeAddressLines(node, connections));
	}
	return parts.join(', ');
}

export { capitalized as capitalizedWords };
