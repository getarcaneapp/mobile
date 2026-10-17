/** Port of Models/Network/Topology.swift. */

/** TopologyNodeType distinguishes network nodes from container nodes. */
export type TopologyNodeType = 'network' | 'container';

export const TopologyNodeType = {
	network: 'network',
	container: 'container'
} as const satisfies Record<string, TopologyNodeType>;

/** TopologyNodeMetadata carries additional context shown by the UI. */
export interface TopologyNodeMetadata {
	driver?: string;
	scope?: string;
	status?: string;
	image?: string;
	isDefault?: boolean;
}

/** TopologyNode is a single node (network or container) in the topology graph. */
export interface TopologyNode {
	id: string;
	name: string;
	type: TopologyNodeType;
	metadata: TopologyNodeMetadata;
}

export const TopologyNode = {
	make(init: Omit<TopologyNode, 'metadata'> & { metadata?: TopologyNodeMetadata }): TopologyNode {
		return { ...init, metadata: init.metadata ?? {} };
	}
} as const;

/** TopologyEdge is a directed edge from a network node to a container node. */
export interface TopologyEdge {
	id: string;
	source: string;
	target: string;
	ipv4Address?: string;
	ipv6Address?: string;
}

/** NetworkTopology is the full topology graph for a Docker environment. */
export interface NetworkTopology {
	nodes: TopologyNode[];
	edges: TopologyEdge[];
}
