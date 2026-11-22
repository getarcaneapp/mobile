import { localizedStandardCompare } from '@/core/list-sort-order';
import type { NetworkTopology, TopologyEdge, TopologyNode } from '@/sdk/models/network/Topology';

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

export type TopologyConnection = {
	id: string;
	otherNode: TopologyNode;
	ipv4Address?: string;
	ipv6Address?: string;
};

export const connectionHasNoAddress = (c: TopologyConnection) => !c.ipv4Address && !c.ipv6Address;

const outerPadding = 16;
const groupWidth = 340;
const childIndent = 28;
const railInset = 13;
const networkHeight = 68;
const containerHeight = 104;
const linkHeight = 52;
const rowGap = 12;
const groupGap = 28;

const lessThan = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function nodeSort(left: TopologyNode, right: TopologyNode) {
	const comparison = localizedStandardCompare(left.name, right.name);
	if (comparison !== 0) return comparison;
	return lessThan(left.id, right.id);
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

export type Frame = { x: number; y: number; width: number; height: number };

export type TopologyPlacementKind = 'network' | 'container' | 'link';

export type TopologyPlacement = {
	key: string;
	kind: TopologyPlacementKind;
	node: TopologyNode;
	frame: Frame;
	connections: TopologyConnection[];
	memberCount: number;
};

export type TopologyRail = { x: number; top: number; childLeft: number; stops: number[] };

export type TopologyGraphLayout = {
	placements: TopologyPlacement[];
	rails: TopologyRail[];
	contentSize: Size;
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
	const validEdges = validEdgesFor(topology, resolvedNodes);

	const connectionsByNode = new Map<string, TopologyConnection[]>();
	for (const node of uniqueNodes)
		connectionsByNode.set(node.id, connectionsFor(node, validEdges, resolvedNodes));

	const primaryNetwork = new Map<string, string>();
	const isolated: TopologyNode[] = [];
	for (const container of containers) {
		let primary: { id: string; order: number } | undefined;
		for (const connection of connectionsByNode.get(container.id) ?? []) {
			const order = networkOrder.get(connection.otherNode.id);
			if (order === undefined) continue;
			if (!primary || order < primary.order) primary = { id: connection.otherNode.id, order };
		}
		if (primary) primaryNetwork.set(container.id, primary.id);
		else isolated.push(container);
	}

	const placements: TopologyPlacement[] = [];
	const rails: TopologyRail[] = [];
	const childLeft = outerPadding + childIndent;
	const childWidth = groupWidth - childIndent;
	let top = outerPadding;

	for (const network of networks) {
		const members = connectionsByNode.get(network.id) ?? [];
		placements.push({
			key: network.id,
			kind: 'network',
			node: network,
			frame: { x: outerPadding, y: top, width: groupWidth, height: networkHeight },
			connections: members,
			memberCount: members.length
		});
		const railTop = top + networkHeight;
		top = railTop;
		const stops: number[] = [];
		const seen = new Set<string>();
		const ordered = [
			...members.filter((m) => primaryNetwork.get(m.otherNode.id) === network.id),
			...members.filter((m) => primaryNetwork.get(m.otherNode.id) !== network.id)
		];
		for (const member of ordered) {
			const container = member.otherNode;
			if (seen.has(container.id)) continue;
			seen.add(container.id);
			const isPrimary = primaryNetwork.get(container.id) === network.id;
			const height = isPrimary ? containerHeight : linkHeight;
			top += rowGap;
			placements.push({
				key: `${network.id}>${container.id}`,
				kind: isPrimary ? 'container' : 'link',
				node: container,
				frame: { x: childLeft, y: top, width: childWidth, height },
				connections: isPrimary ? (connectionsByNode.get(container.id) ?? []) : [member],
				memberCount: (connectionsByNode.get(container.id) ?? []).length
			});
			stops.push(top + height / 2);
			top += height;
		}
		if (stops.length > 0)
			rails.push({ x: outerPadding + railInset, top: railTop, childLeft, stops });
		top += groupGap;
	}
	for (const container of isolated) {
		placements.push({
			key: container.id,
			kind: 'container',
			node: container,
			frame: { x: outerPadding, y: top, width: groupWidth, height: containerHeight },
			connections: [],
			memberCount: 0
		});
		top += containerHeight + rowGap;
	}

	return {
		placements,
		rails,
		contentSize: {
			width: outerPadding * 2 + groupWidth,
			height: Math.max(top - (isolated.length > 0 ? rowGap : groupGap), 0) + outerPadding
		}
	};
}

export function topologyConnections(
	node: TopologyNode,
	topology: NetworkTopology
): TopologyConnection[] {
	const nodeByID = new Map<string, TopologyNode>();
	for (const candidate of topology.nodes)
		if (!nodeByID.has(candidate.id)) nodeByID.set(candidate.id, candidate);
	return connectionsFor(node, validEdgesFor(topology, nodeByID), nodeByID);
}

export const TopologyScale = { minimum: 0.35, maximum: 1.75 };

export const clampScale = (value: number) =>
	Math.min(Math.max(value, TopologyScale.minimum), TopologyScale.maximum);

export function fitScale(viewport: Size, content: Size) {
	return clampScale(
		Math.min((viewport.width - 32) / content.width, (viewport.height - 32) / content.height, 1)
	);
}

export function widthFitScale(viewport: Size, content: Size) {
	return clampScale(Math.min(viewport.width / content.width, 1.15));
}
