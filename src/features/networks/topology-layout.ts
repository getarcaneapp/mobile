import { localizedStandardCompare } from '@/core/list-sort-order';
import type { NetworkTopology, TopologyEdge, TopologyNode } from '@/sdk/models/network/Topology';
import { systemColors } from '@/theme/colors';

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

export type TopologyConnection = {
	id: string;
	otherNode: TopologyNode;
	ipv4Address?: string;
	ipv6Address?: string;
};

export const connectionHasNoAddress = (c: TopologyConnection) => !c.ipv4Address && !c.ipv6Address;

const networkNodeSize: Size = { width: 224, height: 112 };
const containerNodeSize: Size = { width: 268, height: 164 };
const outerPadding = 36;
const columnGap = 180;
const rowGap = 28;
const groupGap = 72;

const lessThan = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function nodeSort(left: TopologyNode, right: TopologyNode) {
	const comparison = localizedStandardCompare(left.name, right.name);
	if (comparison !== 0) return comparison;
	return lessThan(left.id, right.id);
}

function columnHeight(count: number, nodeHeight: number) {
	if (count <= 0) return 0;
	return count * nodeHeight + (count - 1) * rowGap;
}

function connectionsFor(
	node: TopologyNode,
	edges: TopologyEdge[],
	nodeByID: Map<string, TopologyNode>
): TopologyConnection[] {
	const matching = edges.filter((edge) =>
		node.type === 'network' ? edge.source === node.id : edge.target === node.id
	);
	const result: TopologyConnection[] = [];
	matching.forEach((edge, index) => {
		const otherID = node.type === 'network' ? edge.target : edge.source;
		const otherNode = nodeByID.get(otherID);
		if (!otherNode) return;
		result.push({
			id: `${edge.id}#${index}`,
			otherNode,
			ipv4Address: edge.ipv4Address,
			ipv6Address: edge.ipv6Address
		});
	});
	return result.sort((a, b) => {
		const comparison = localizedStandardCompare(a.otherNode.name, b.otherNode.name);
		if (comparison !== 0) return comparison;
		return lessThan(a.id, b.id);
	});
}

function validEdgesFor(topology: NetworkTopology, nodeByID: Map<string, TopologyNode>) {
	const seen = new Set<string>();
	return topology.edges.filter((edge) => {
		if (seen.has(edge.id)) return false;
		seen.add(edge.id);
		return (
			nodeByID.get(edge.source)?.type === 'network' &&
			nodeByID.get(edge.target)?.type === 'container'
		);
	});
}

export type TopologyGraphLayout = {
	nodes: TopologyNode[];
	edges: TopologyEdge[];
	nodeByID: Map<string, TopologyNode>;
	connectionsByNode: Map<string, TopologyConnection[]>;
	contentSize: Size;
	positions: Map<string, Point>;
};

export function makeTopologyLayout(topology: NetworkTopology): TopologyGraphLayout {
	const uniqueNodes: TopologyNode[] = [];
	const resolvedNodes = new Map<string, TopologyNode>();
	for (const node of topology.nodes) {
		if (resolvedNodes.has(node.id)) continue;
		uniqueNodes.push(node);
		resolvedNodes.set(node.id, node);
	}
	const networks = uniqueNodes.filter((n) => n.type === 'network').sort(nodeSort);
	const containers = uniqueNodes.filter((n) => n.type === 'container').sort(nodeSort);
	const networkOrder = new Map(networks.map((n, i) => [n.id, i]));

	const validEdges = validEdgesFor(topology, resolvedNodes).sort((left, right) => {
		const leftOrder = networkOrder.get(left.source) ?? Number.MAX_SAFE_INTEGER;
		const rightOrder = networkOrder.get(right.source) ?? Number.MAX_SAFE_INTEGER;
		if (leftOrder !== rightOrder) return leftOrder - rightOrder;
		const comparison = localizedStandardCompare(
			resolvedNodes.get(left.target)?.name ?? '',
			resolvedNodes.get(right.target)?.name ?? ''
		);
		if (comparison !== 0) return comparison;
		if (left.target !== right.target) return lessThan(left.target, right.target);
		return lessThan(left.id, right.id);
	});

	const containersByNetwork = new Map<string, TopologyNode[]>();
	const isolated: TopologyNode[] = [];
	for (const container of containers) {
		let primary: { id: string; order: number } | undefined;
		for (const edge of validEdges) {
			if (edge.target !== container.id) continue;
			const order = networkOrder.get(edge.source);
			if (order === undefined) continue;
			if (!primary || order < primary.order) primary = { id: edge.source, order };
		}
		if (primary) {
			const group = containersByNetwork.get(primary.id) ?? [];
			group.push(container);
			containersByNetwork.set(primary.id, group);
		} else {
			isolated.push(container);
		}
	}
	for (const group of containersByNetwork.values()) group.sort(nodeSort);

	const networkX = outerPadding + networkNodeSize.width / 2;
	const containerX = outerPadding + networkNodeSize.width + columnGap + containerNodeSize.width / 2;
	const positions = new Map<string, Point>();
	let currentTop = outerPadding;

	for (const network of networks) {
		const grouped = containersByNetwork.get(network.id) ?? [];
		const groupHeight = Math.max(
			networkNodeSize.height,
			columnHeight(grouped.length, containerNodeSize.height)
		);
		positions.set(network.id, { x: networkX, y: currentTop + groupHeight / 2 });
		grouped.forEach((container, index) => {
			positions.set(container.id, {
				x: containerX,
				y: currentTop + containerNodeSize.height / 2 + index * (containerNodeSize.height + rowGap)
			});
		});
		currentTop += groupHeight + groupGap;
	}
	if (isolated.length > 0) {
		isolated.forEach((container, index) => {
			positions.set(container.id, {
				x: containerX,
				y: currentTop + containerNodeSize.height / 2 + index * (containerNodeSize.height + rowGap)
			});
		});
		currentTop += columnHeight(isolated.length, containerNodeSize.height) + groupGap;
	}

	const minimumHeight = Math.max(networkNodeSize.height, containerNodeSize.height);
	const contentHeight = Math.max(
		currentTop - groupGap + outerPadding,
		minimumHeight + outerPadding * 2
	);
	const nodes = [...networks, ...containers];
	const connectionsByNode = new Map<string, TopologyConnection[]>();
	for (const node of nodes)
		connectionsByNode.set(node.id, connectionsFor(node, validEdges, resolvedNodes));

	return {
		nodes,
		edges: validEdges,
		nodeByID: resolvedNodes,
		connectionsByNode,
		contentSize: {
			width: outerPadding * 2 + networkNodeSize.width + columnGap + containerNodeSize.width,
			height: contentHeight
		},
		positions
	};
}

export const nodeSize = (node: TopologyNode): Size =>
	node.type === 'network' ? networkNodeSize : containerNodeSize;

export const nodePosition = (layout: TopologyGraphLayout, node: TopologyNode): Point =>
	layout.positions.get(node.id) ?? {
		x: layout.contentSize.width / 2,
		y: layout.contentSize.height / 2
	};

export function topologyConnections(
	node: TopologyNode,
	topology: NetworkTopology
): TopologyConnection[] {
	const nodeByID = new Map<string, TopologyNode>();
	for (const candidate of topology.nodes)
		if (!nodeByID.has(candidate.id)) nodeByID.set(candidate.id, candidate);
	return connectionsFor(node, validEdgesFor(topology, nodeByID), nodeByID);
}

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

export const TopologyScale = { minimum: 0.35, maximum: 1.75 };

export const clampScale = (value: number) =>
	Math.min(Math.max(value, TopologyScale.minimum), TopologyScale.maximum);

export function fitScale(viewport: Size, content: Size) {
	return clampScale(
		Math.min((viewport.width - 32) / content.width, (viewport.height - 32) / content.height, 1)
	);
}
