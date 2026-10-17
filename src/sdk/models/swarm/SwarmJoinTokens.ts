import type { JSONValue } from '../../types/json';

export interface SwarmInitRequest {
	listenAddr?: string;
	advertiseAddr?: string;
	dataPathAddr?: string;
	dataPathPort?: number;
	forceNewCluster?: boolean;
	spec: JSONValue;
	autoLockManagers?: boolean;
	availability?: string;
	defaultAddrPool?: string[];
	subnetSize?: number;
}

export interface SwarmInitResponse {
	nodeId: string;
}

export interface SwarmJoinRequest {
	listenAddr?: string;
	advertiseAddr?: string;
	dataPathAddr?: string;
	remoteAddrs: string[];
	joinToken: string;
	availability?: string;
}

export interface SwarmLeaveRequest {
	force?: boolean;
}

export interface SwarmUnlockRequest {
	key: string;
}

export interface SwarmUnlockKeyResponse {
	unlockKey: string;
}

export interface SwarmJoinTokens {
	worker: string;
	manager: string;
}

export interface SwarmRotateJoinTokensRequest {
	rotateWorkerToken?: boolean;
	rotateManagerToken?: boolean;
}

export interface SwarmUpdateRequest {
	version?: number;
	spec: JSONValue;
	rotateWorkerToken?: boolean;
	rotateManagerToken?: boolean;
	rotateManagerUnlockKey?: boolean;
}
