/** Port of Models/Environment/EnvironmentModel.swift. */
import type { ISODateString } from '../base/date';

/**
 * Lightweight mTLS certificate status for an edge environment surfaced in
 * environment list/detail responses.
 */
export interface EdgeMTLSCertificate {
	commonName?: string;
	expiresAt?: ISODateString;
	daysRemaining?: number;
	expired: boolean;
	expiringSoon: boolean;
}

export const EdgeMTLSCertificate = {
	/** Swift init defaults (`expired: false`, `expiringSoon: false`). */
	make(args: Partial<EdgeMTLSCertificate> = {}): EdgeMTLSCertificate {
		return { ...args, expired: args.expired ?? false, expiringSoon: args.expiringSoon ?? false };
	}
} as const;

/** One Docker environment (local or edge). */
export interface Environment {
	id: string;
	name?: string;
	apiUrl: string;
	status: string;
	enabled: boolean;
	isEdge: boolean;
	lastSeen?: ISODateString;
	edgeTransport?: string;
	/**
	 * Most recently used tunnel transport ("grpc" | "websocket"), persisted so
	 * it stays known while the tunnel is down or the agent is poll-only.
	 */
	lastEdgeTransport?: string;
	edgeSecurityMode?: string;
	edgeSessionId?: string;
	edgeAgentInstance?: string;
	edgeCapabilities?: string[];
	connected?: boolean;
	connectedAt?: ISODateString;
	lastHeartbeat?: ISODateString;
	lastPollAt?: ISODateString;
	edgeMTLSCertificate?: EdgeMTLSCertificate;
	apiKey?: string;
}

export const Environment = {
	/** Swift init defaults (`enabled: true`, `isEdge: false`). */
	make(
		args: Omit<Environment, 'enabled' | 'isEdge'> & { enabled?: boolean; isEdge?: boolean }
	): Environment {
		return { ...args, enabled: args.enabled ?? true, isEdge: args.isEdge ?? false };
	}
} as const;

/** Body for `POST /environments`. */
export interface CreateEnvironment {
	apiUrl: string;
	name?: string;
	enabled?: boolean;
	accessToken?: string;
	bootstrapToken?: string;
	useApiKey?: boolean;
	isEdge?: boolean;
}

/** Body for `PUT /environments/{id}`. */
export interface UpdateEnvironment {
	apiUrl?: string;
	name?: string;
	enabled?: boolean;
	accessToken?: string;
	bootstrapToken?: string;
	regenerateApiKey?: boolean;
}

/** Response of the test-connection endpoint. */
export interface EnvironmentTestResult {
	status: string;
	message?: string;
}

/** Body for the test-connection endpoint. */
export interface TestConnectionRequest {
	apiUrl?: string;
}

/** Body for the local agent pairing endpoint. */
export interface AgentPairRequest {
	rotate?: boolean;
}

/** Response for the local agent pairing endpoint. */
export interface AgentPairResponse {
	token: string;
}

/** Response payload for the environment version endpoint. */
export interface EnvironmentVersion {
	currentVersion: string;
	currentTag?: string;
	currentDigest?: string;
	revision: string;
	shortRevision: string;
	goVersion: string;
	enabledFeatures?: string[];
	buildTime?: string;
	displayVersion: string;
	isSemverVersion: boolean;
	newestVersion?: string;
	newestDigest?: string;
	updateAvailable: boolean;
	releaseUrl?: string;
	releaseNotes?: string;
	releasedAt?: string;
}
