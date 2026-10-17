export type TopologyNodeType = 'network' | 'container';

export const TopologyNodeType = {
	network: 'network',
	container: 'container'
} as const satisfies Record<string, TopologyNodeType>;

export interface TopologyNodeMetadata {
	driver?: string;
	scope?: string;
	status?: string;
	image?: string;
	isDefault?: boolean;
}

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

export interface TopologyEdge {
	id: string;
	source: string;
	target: string;
	ipv4Address?: string;
	ipv6Address?: string;
}

export interface NetworkTopology {
	nodes: TopologyNode[];
	edges: TopologyEdge[];
}
