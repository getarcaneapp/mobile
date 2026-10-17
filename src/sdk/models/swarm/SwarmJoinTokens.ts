/** Port of Models/Swarm/SwarmJoinTokens.swift. */
import type { JSONValue } from '../../types/json';

/**
 * Body for `POST /environments/{id}/swarm/init`.
 * The Docker `spec` blob is preserved as raw JSON.
 */
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

/** Response from `POST /environments/{id}/swarm/init`. */
export interface SwarmInitResponse {
	nodeId: string;
}

/** Body for `POST /environments/{id}/swarm/join`. */
export interface SwarmJoinRequest {
	listenAddr?: string;
	advertiseAddr?: string;
	dataPathAddr?: string;
	remoteAddrs: string[];
	joinToken: string;
	availability?: string;
}

/** Body for `POST /environments/{id}/swarm/leave`. */
export interface SwarmLeaveRequest {
	force?: boolean;
}

/** Body for `POST /environments/{id}/swarm/unlock`. */
export interface SwarmUnlockRequest {
	key: string;
}

/** Response from `GET /environments/{id}/swarm/unlock-key`. */
export interface SwarmUnlockKeyResponse {
	unlockKey: string;
}

/** Worker / manager join tokens for the swarm. */
export interface SwarmJoinTokens {
	worker: string;
	manager: string;
}

/** Body for `POST /environments/{id}/swarm/join-tokens/rotate`. */
export interface SwarmRotateJoinTokensRequest {
	rotateWorkerToken?: boolean;
	rotateManagerToken?: boolean;
}

/** Body for `PUT /environments/{id}/swarm/spec`. */
export interface SwarmUpdateRequest {
	version?: number;
	spec: JSONValue;
	rotateWorkerToken?: boolean;
	rotateManagerToken?: boolean;
	rotateManagerUnlockKey?: boolean;
}
