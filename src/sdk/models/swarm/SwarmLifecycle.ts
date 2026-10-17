import { D } from '../base/decoding';
import { SwarmNodeAgentCandidate, SwarmNodeAgentState } from './SwarmNode';

export interface SwarmNodeAgentReconcileResult {
	nodeID: string;
	state: SwarmNodeAgentState;
	environmentID?: string;
	candidates: SwarmNodeAgentCandidate[];
}

export const SwarmNodeAgentReconcileResult = {
	id(this: void, value: SwarmNodeAgentReconcileResult): string {
		return value.nodeID;
	},
	make(
		this: void,
		args: Pick<SwarmNodeAgentReconcileResult, 'nodeID' | 'state'> &
			Partial<SwarmNodeAgentReconcileResult>
	): SwarmNodeAgentReconcileResult {
		return {
			nodeID: args.nodeID,
			state: args.state,
			environmentID: args.environmentID,
			candidates: args.candidates ?? []
		};
	},
	decode(this: void, raw: unknown): SwarmNodeAgentReconcileResult {
		const o = D.object(raw, 'SwarmNodeAgentReconcileResult');
		return {
			nodeID: D.string(o, 'nodeId'),
			state: D.optNested(o, 'state', SwarmNodeAgentState.decode) ?? 'none',
			environmentID: D.optString(o, 'environmentId'),
			candidates: D.optArray(o, 'candidates', SwarmNodeAgentCandidate.decode) ?? []
		};
	},
	encode(this: void, value: SwarmNodeAgentReconcileResult): Record<string, unknown> {
		return {
			nodeId: value.nodeID,
			state: value.state,
			environmentId: value.environmentID,
			candidates: value.candidates.map(SwarmNodeAgentCandidate.encode)
		};
	}
} as const;

export interface SwarmNodeAgentReconcileResponse {
	results: SwarmNodeAgentReconcileResult[];
}

export const SwarmNodeAgentReconcileResponse = {
	make(
		this: void,
		args: Partial<SwarmNodeAgentReconcileResponse> = {}
	): SwarmNodeAgentReconcileResponse {
		return { results: args.results ?? [] };
	},
	decode(this: void, raw: unknown): SwarmNodeAgentReconcileResponse {
		const o = D.object(raw, 'SwarmNodeAgentReconcileResponse');
		return { results: D.optArray(o, 'results', SwarmNodeAgentReconcileResult.decode) ?? [] };
	},
	encode(this: void, value: SwarmNodeAgentReconcileResponse): Record<string, unknown> {
		return { results: value.results.map(SwarmNodeAgentReconcileResult.encode) };
	}
} as const;

export interface SwarmNodeAgentBindingRequest {
	environmentID: string;
	rebind: boolean;
	replaceDeployment: boolean;
}

export const SwarmNodeAgentBindingRequest = {
	make(
		args: Pick<SwarmNodeAgentBindingRequest, 'environmentID'> &
			Partial<SwarmNodeAgentBindingRequest>
	): SwarmNodeAgentBindingRequest {
		return {
			environmentID: args.environmentID,
			rebind: args.rebind ?? false,
			replaceDeployment: args.replaceDeployment ?? false
		};
	},
	decode(raw: unknown): SwarmNodeAgentBindingRequest {
		const o = D.object(raw, 'SwarmNodeAgentBindingRequest');
		return {
			environmentID: D.string(o, 'environmentId'),
			rebind: D.boolean(o, 'rebind'),
			replaceDeployment: D.boolean(o, 'replaceDeployment')
		};
	},
	encode(value: SwarmNodeAgentBindingRequest): Record<string, unknown> {
		return {
			environmentId: value.environmentID,
			rebind: value.rebind,
			replaceDeployment: value.replaceDeployment
		};
	}
} as const;

export interface SwarmJoinCandidate {
	environmentID: string;
	environmentName: string;
	environmentType: string;
	status: string;
}

export const SwarmJoinCandidate = {
	id(this: void, value: SwarmJoinCandidate): string {
		return value.environmentID;
	},
	decode(this: void, raw: unknown): SwarmJoinCandidate {
		const o = D.object(raw, 'SwarmJoinCandidate');
		return {
			environmentID: D.string(o, 'environmentId'),
			environmentName: D.string(o, 'environmentName'),
			environmentType: D.string(o, 'environmentType'),
			status: D.string(o, 'status')
		};
	},
	encode(this: void, value: SwarmJoinCandidate): Record<string, unknown> {
		return {
			environmentId: value.environmentID,
			environmentName: value.environmentName,
			environmentType: value.environmentType,
			status: value.status
		};
	}
} as const;

export type SwarmJoinEnvironmentRole = 'worker' | 'manager' | (string & {});

export const SwarmJoinEnvironmentRole = {
	worker: 'worker',
	manager: 'manager',
	knownCases: ['worker', 'manager'] as const,
	isKnown(this: void, value: SwarmJoinEnvironmentRole): boolean {
		return (SwarmJoinEnvironmentRole.knownCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): SwarmJoinEnvironmentRole {
		return raw;
	},
	rawValue(this: void, value: SwarmJoinEnvironmentRole): string {
		return value;
	},
	decode(this: void, raw: unknown): SwarmJoinEnvironmentRole {
		return D.str(raw);
	},
	encode(this: void, value: SwarmJoinEnvironmentRole): string {
		return value;
	}
} as const;

export interface SwarmJoinEnvironmentTarget {
	environmentID: string;
	role: SwarmJoinEnvironmentRole;
	availability?: string;
	listenAddr?: string;
	advertiseAddr?: string;
	dataPathAddr?: string;
}

export const SwarmJoinEnvironmentTarget = {
	decode(this: void, raw: unknown): SwarmJoinEnvironmentTarget {
		const o = D.object(raw, 'SwarmJoinEnvironmentTarget');
		return {
			environmentID: D.string(o, 'environmentId'),
			role: D.nested(o, 'role', SwarmJoinEnvironmentRole.decode),
			availability: D.optString(o, 'availability'),
			listenAddr: D.optString(o, 'listenAddr'),
			advertiseAddr: D.optString(o, 'advertiseAddr'),
			dataPathAddr: D.optString(o, 'dataPathAddr')
		};
	},
	encode(this: void, value: SwarmJoinEnvironmentTarget): Record<string, unknown> {
		return {
			environmentId: value.environmentID,
			role: value.role,
			availability: value.availability,
			listenAddr: value.listenAddr,
			advertiseAddr: value.advertiseAddr,
			dataPathAddr: value.dataPathAddr
		};
	}
} as const;

export interface SwarmJoinEnvironmentsRequest {
	remoteAddrs: string[];
	targets: SwarmJoinEnvironmentTarget[];
}

export const SwarmJoinEnvironmentsRequest = {
	make(
		args: Pick<SwarmJoinEnvironmentsRequest, 'targets'> & Partial<SwarmJoinEnvironmentsRequest>
	): SwarmJoinEnvironmentsRequest {
		return { remoteAddrs: args.remoteAddrs ?? [], targets: args.targets };
	},
	decode(raw: unknown): SwarmJoinEnvironmentsRequest {
		const o = D.object(raw, 'SwarmJoinEnvironmentsRequest');
		return {
			remoteAddrs: D.array(o, 'remoteAddrs', D.str),
			targets: D.array(o, 'targets', SwarmJoinEnvironmentTarget.decode)
		};
	},
	encode(value: SwarmJoinEnvironmentsRequest): Record<string, unknown> {
		return {
			remoteAddrs: value.remoteAddrs,
			targets: value.targets.map(SwarmJoinEnvironmentTarget.encode)
		};
	}
} as const;

export type SwarmJoinEnvironmentResultState =
	| 'joined'
	| 'already_member'
	| 'joined_unverified'
	| 'failed'
	| (string & {});

export const SwarmJoinEnvironmentResultState = {
	joined: 'joined',
	alreadyMember: 'already_member',
	joinedUnverified: 'joined_unverified',
	failed: 'failed',
	knownCases: ['joined', 'already_member', 'joined_unverified', 'failed'] as const,
	isKnown(this: void, value: SwarmJoinEnvironmentResultState): boolean {
		return (SwarmJoinEnvironmentResultState.knownCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): SwarmJoinEnvironmentResultState {
		return raw;
	},
	rawValue(this: void, value: SwarmJoinEnvironmentResultState): string {
		return value;
	},
	decode(this: void, raw: unknown): SwarmJoinEnvironmentResultState {
		return D.str(raw);
	},
	encode(this: void, value: SwarmJoinEnvironmentResultState): string {
		return value;
	}
} as const;

export interface SwarmJoinEnvironmentResult {
	environmentID: string;
	state: SwarmJoinEnvironmentResultState;
	nodeID?: string;
	error?: string;
}

export const SwarmJoinEnvironmentResult = {
	id(this: void, value: SwarmJoinEnvironmentResult): string {
		return value.environmentID;
	},
	decode(this: void, raw: unknown): SwarmJoinEnvironmentResult {
		const o = D.object(raw, 'SwarmJoinEnvironmentResult');
		return {
			environmentID: D.string(o, 'environmentId'),
			state: D.nested(o, 'state', SwarmJoinEnvironmentResultState.decode),
			nodeID: D.optString(o, 'nodeId'),
			error: D.optString(o, 'error')
		};
	},
	encode(this: void, value: SwarmJoinEnvironmentResult): Record<string, unknown> {
		return {
			environmentId: value.environmentID,
			state: value.state,
			nodeId: value.nodeID,
			error: value.error
		};
	}
} as const;

export interface SwarmJoinEnvironmentsResponse {
	results: SwarmJoinEnvironmentResult[];
}

export const SwarmJoinEnvironmentsResponse = {
	make(
		this: void,
		args: Partial<SwarmJoinEnvironmentsResponse> = {}
	): SwarmJoinEnvironmentsResponse {
		return { results: args.results ?? [] };
	},
	decode(this: void, raw: unknown): SwarmJoinEnvironmentsResponse {
		const o = D.object(raw, 'SwarmJoinEnvironmentsResponse');
		return { results: D.optArray(o, 'results', SwarmJoinEnvironmentResult.decode) ?? [] };
	},
	encode(this: void, value: SwarmJoinEnvironmentsResponse): Record<string, unknown> {
		return { results: value.results.map(SwarmJoinEnvironmentResult.encode) };
	}
} as const;
