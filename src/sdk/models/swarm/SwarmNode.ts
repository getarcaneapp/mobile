/** Port of Models/Swarm/SwarmNode.swift. */
import { D } from '../base/decoding';
import type { ISODateString } from '../base/date';

/** State of the Arcane node-agent reporting back from a swarm node. */
export type SwarmNodeAgentState =
	| 'none'
	| 'pending'
	| 'offline'
	| 'connected'
	| 'mismatched'
	| 'ambiguous'
	| (string & {});

export const SwarmNodeAgentState = {
	none: 'none',
	pending: 'pending',
	offline: 'offline',
	connected: 'connected',
	mismatched: 'mismatched',
	ambiguous: 'ambiguous',
	knownCases: ['none', 'pending', 'offline', 'connected', 'mismatched', 'ambiguous'] as const,
	isKnown(this: void, value: SwarmNodeAgentState): boolean {
		return (SwarmNodeAgentState.knownCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): SwarmNodeAgentState {
		return raw;
	},
	rawValue(this: void, value: SwarmNodeAgentState): string {
		return value;
	},
	/** Swift `init(from:)`: any string passes through (unknown values are kept). */
	decode(this: void, raw: unknown): SwarmNodeAgentState {
		return D.str(raw);
	},
	encode(this: void, value: SwarmNodeAgentState): string {
		return value;
	}
} as const;

export type SwarmNodeAgentBindingKind = 'local' | 'environment' | 'dedicated' | (string & {});

export const SwarmNodeAgentBindingKind = {
	local: 'local',
	environment: 'environment',
	dedicated: 'dedicated',
	knownCases: ['local', 'environment', 'dedicated'] as const,
	isKnown(this: void, value: SwarmNodeAgentBindingKind): boolean {
		return (SwarmNodeAgentBindingKind.knownCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): SwarmNodeAgentBindingKind {
		return raw;
	},
	rawValue(this: void, value: SwarmNodeAgentBindingKind): string {
		return value;
	},
	/** Swift `init(from:)`: any string passes through (unknown values are kept). */
	decode(this: void, raw: unknown): SwarmNodeAgentBindingKind {
		return D.str(raw);
	},
	encode(this: void, value: SwarmNodeAgentBindingKind): string {
		return value;
	}
} as const;

export interface SwarmNodeAgentCandidate {
	/** JSON key `environmentId`. */
	environmentID: string;
	environmentName: string;
	environmentType: string;
}

export const SwarmNodeAgentCandidate = {
	/** Swift `Identifiable.id`. */
	id(this: void, value: SwarmNodeAgentCandidate): string {
		return value.environmentID;
	},
	decode(this: void, raw: unknown): SwarmNodeAgentCandidate {
		const o = D.object(raw, 'SwarmNodeAgentCandidate');
		return {
			environmentID: D.string(o, 'environmentId'),
			environmentName: D.string(o, 'environmentName'),
			environmentType: D.string(o, 'environmentType')
		};
	},
	encode(this: void, value: SwarmNodeAgentCandidate): Record<string, unknown> {
		return {
			environmentId: value.environmentID,
			environmentName: value.environmentName,
			environmentType: value.environmentType
		};
	}
} as const;

/** Coverage info for a swarm node from Arcane's node-agent perspective. */
export interface SwarmNodeAgentStatus {
	state: SwarmNodeAgentState;
	bindingKind?: SwarmNodeAgentBindingKind;
	environmentId?: string;
	environmentName?: string;
	environmentType?: string;
	connected?: boolean;
	lastHeartbeat?: ISODateString;
	lastPollAt?: ISODateString;
	reportedNodeId?: string;
	reportedHostname?: string;
	candidates: SwarmNodeAgentCandidate[];
}

export const SwarmNodeAgentStatus = {
	/** Swift memberwise init (`candidates` defaults to `[]`). */
	make(
		this: void,
		args: Pick<SwarmNodeAgentStatus, 'state'> & Partial<SwarmNodeAgentStatus>
	): SwarmNodeAgentStatus {
		return {
			state: args.state,
			bindingKind: args.bindingKind,
			environmentId: args.environmentId,
			environmentName: args.environmentName,
			environmentType: args.environmentType,
			connected: args.connected,
			lastHeartbeat: args.lastHeartbeat,
			lastPollAt: args.lastPollAt,
			reportedNodeId: args.reportedNodeId,
			reportedHostname: args.reportedHostname,
			candidates: args.candidates ?? []
		};
	},
	/** Swift `init(from:)`: missing `state` → `none`, missing `candidates` → `[]`. */
	decode(this: void, raw: unknown): SwarmNodeAgentStatus {
		const o = D.object(raw, 'SwarmNodeAgentStatus');
		return {
			state: D.optNested(o, 'state', SwarmNodeAgentState.decode) ?? 'none',
			bindingKind: D.optNested(o, 'bindingKind', SwarmNodeAgentBindingKind.decode),
			environmentId: D.optString(o, 'environmentId'),
			environmentName: D.optString(o, 'environmentName'),
			environmentType: D.optString(o, 'environmentType'),
			connected: D.optBoolean(o, 'connected'),
			lastHeartbeat: D.optString(o, 'lastHeartbeat'),
			lastPollAt: D.optString(o, 'lastPollAt'),
			reportedNodeId: D.optString(o, 'reportedNodeId'),
			reportedHostname: D.optString(o, 'reportedHostname'),
			candidates: D.optArray(o, 'candidates', SwarmNodeAgentCandidate.decode) ?? []
		};
	},
	encode(this: void, value: SwarmNodeAgentStatus): Record<string, unknown> {
		return { ...value, candidates: value.candidates.map(SwarmNodeAgentCandidate.encode) };
	}
} as const;

/** A swarm node summary as returned by the list/get endpoints. */
export interface SwarmNode {
	id: string;
	hostname: string;
	role: string;
	availability: string;
	status: string;
	address?: string;
	managerStatus?: string;
	managerAddress?: string;
	reachability?: string;
	labels?: Record<string, string>;
	systemLabels?: Record<string, string>;
	engineVersion?: string;
	platform?: string;
	createdAt: ISODateString;
	updatedAt: ISODateString;
	agent: SwarmNodeAgentStatus;
}

export const SwarmNode = {
	/** Swift memberwise init (`agent` defaults to `.init(state: .none)`). */
	make(
		this: void,
		args: Pick<
			SwarmNode,
			'id' | 'hostname' | 'role' | 'availability' | 'status' | 'createdAt' | 'updatedAt'
		> &
			Partial<SwarmNode>
	): SwarmNode {
		return {
			id: args.id,
			hostname: args.hostname,
			role: args.role,
			availability: args.availability,
			status: args.status,
			address: args.address,
			managerStatus: args.managerStatus,
			managerAddress: args.managerAddress,
			reachability: args.reachability,
			labels: args.labels,
			systemLabels: args.systemLabels,
			engineVersion: args.engineVersion,
			platform: args.platform,
			createdAt: args.createdAt,
			updatedAt: args.updatedAt,
			agent: args.agent ?? SwarmNodeAgentStatus.make({ state: 'none' })
		};
	},
	/** Swift `init(from:)`: missing `agent` → `SwarmNodeAgentStatus(state: .none)`. */
	decode(this: void, raw: unknown): SwarmNode {
		const o = D.object(raw, 'SwarmNode');
		return {
			id: D.string(o, 'id'),
			hostname: D.string(o, 'hostname'),
			role: D.string(o, 'role'),
			availability: D.string(o, 'availability'),
			status: D.string(o, 'status'),
			address: D.optString(o, 'address'),
			managerStatus: D.optString(o, 'managerStatus'),
			managerAddress: D.optString(o, 'managerAddress'),
			reachability: D.optString(o, 'reachability'),
			labels: D.optRecord(o, 'labels', D.str),
			systemLabels: D.optRecord(o, 'systemLabels', D.str),
			engineVersion: D.optString(o, 'engineVersion'),
			platform: D.optString(o, 'platform'),
			createdAt: D.string(o, 'createdAt'),
			updatedAt: D.string(o, 'updatedAt'),
			agent:
				D.optNested(o, 'agent', SwarmNodeAgentStatus.decode) ??
				SwarmNodeAgentStatus.make({ state: 'none' })
		};
	},
	encode(this: void, value: SwarmNode): Record<string, unknown> {
		return { ...value, agent: SwarmNodeAgentStatus.encode(value.agent) };
	}
} as const;

/** Request payload for updating a swarm node's spec. */
export interface SwarmNodeUpdateRequest {
	version?: number;
	name?: string;
	labels?: Record<string, string>;
	role?: string;
	availability?: string;
}

/** Request for the swarm node agent deployment-snippet endpoint. */
export interface SwarmNodeAgentDeploymentRequest {
	rotate: boolean;
}

export const SwarmNodeAgentDeploymentRequest = {
	make(args: Partial<SwarmNodeAgentDeploymentRequest> = {}): SwarmNodeAgentDeploymentRequest {
		return { rotate: args.rotate ?? false };
	}
} as const;

/**
 * File payload returned alongside deployment snippets (re-stated here so the
 * swarm module is self-contained).
 */
export interface SwarmDeploymentSnippetFile {
	name: string;
	content?: string;
	downloadUrl?: string;
	sensitive?: boolean;
	containerPath: string;
	permissions: string;
}

export interface SwarmDeploymentSnippetMTLS {
	dockerRun: string;
	dockerCompose: string;
	files: SwarmDeploymentSnippetFile[];
	hostDirHint: string;
}

export const SwarmDeploymentSnippetMTLS = {
	/** Swift memberwise init (`files` defaults to `[]`). */
	make(
		args: Pick<SwarmDeploymentSnippetMTLS, 'dockerRun' | 'dockerCompose' | 'hostDirHint'> &
			Partial<SwarmDeploymentSnippetMTLS>
	): SwarmDeploymentSnippetMTLS {
		return {
			dockerRun: args.dockerRun,
			dockerCompose: args.dockerCompose,
			files: args.files ?? [],
			hostDirHint: args.hostDirHint
		};
	}
} as const;

/** Bundle of docker-run / docker-compose deployment snippets for a swarm node. */
export interface SwarmNodeAgentDeployment {
	dockerRun: string;
	dockerCompose: string;
	mtls?: SwarmDeploymentSnippetMTLS;
	environmentId: string;
	agent: SwarmNodeAgentStatus;
}

export const SwarmNodeAgentDeployment = {
	decode(this: void, raw: unknown): SwarmNodeAgentDeployment {
		const o = D.object(raw, 'SwarmNodeAgentDeployment');
		return {
			dockerRun: D.string(o, 'dockerRun'),
			dockerCompose: D.string(o, 'dockerCompose'),
			mtls: D.optNested(o, 'mtls', D.cast<SwarmDeploymentSnippetMTLS>),
			environmentId: D.string(o, 'environmentId'),
			agent: D.nested(o, 'agent', SwarmNodeAgentStatus.decode)
		};
	},
	encode(this: void, value: SwarmNodeAgentDeployment): Record<string, unknown> {
		return { ...value, agent: SwarmNodeAgentStatus.encode(value.agent) };
	}
} as const;

/** Identifies the local swarm node (used by the cross-environment node identity endpoint). */
export interface SwarmNodeIdentity {
	swarmNodeId: string;
	hostname: string;
	role: string;
	engineVersion: string;
	swarmActive: boolean;
}
