import type { ISODateString } from '../base/date';

export interface EdgeMTLSCertificate {
	commonName?: string;
	expiresAt?: ISODateString;
	daysRemaining?: number;
	expired: boolean;
	expiringSoon: boolean;
}

export const EdgeMTLSCertificate = {
	make(args: Partial<EdgeMTLSCertificate> = {}): EdgeMTLSCertificate {
		return { ...args, expired: args.expired ?? false, expiringSoon: args.expiringSoon ?? false };
	}
} as const;

export interface Environment {
	id: string;
	name?: string;
	apiUrl: string;
	status: string;
	enabled: boolean;
	isEdge: boolean;
	lastSeen?: ISODateString;
	edgeTransport?: string;
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
	make(
		args: Omit<Environment, 'enabled' | 'isEdge'> & { enabled?: boolean; isEdge?: boolean }
	): Environment {
		return { ...args, enabled: args.enabled ?? true, isEdge: args.isEdge ?? false };
	}
} as const;

export interface CreateEnvironment {
	apiUrl: string;
	name?: string;
	enabled?: boolean;
	accessToken?: string;
	bootstrapToken?: string;
	useApiKey?: boolean;
	isEdge?: boolean;
}

export interface UpdateEnvironment {
	apiUrl?: string;
	name?: string;
	enabled?: boolean;
	accessToken?: string;
	bootstrapToken?: string;
	regenerateApiKey?: boolean;
}

export interface EnvironmentTestResult {
	status: string;
	message?: string;
}

export interface TestConnectionRequest {
	apiUrl?: string;
}

export interface AgentPairRequest {
	rotate?: boolean;
}

export interface AgentPairResponse {
	token: string;
}

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
