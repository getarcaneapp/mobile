/** Port of Models/Federated/FederatedCredential.swift. */
import type { ISODateString } from '../base/date';

export interface FederatedCredential {
	id: string;
	name: string;
	description?: string;
	enabled: boolean;
	issuerUrl: string;
	audiences: string[];
	subjectClaim: string;
	subjectMatch: string;
	matchType: string;
	roleId: string;
	environmentId?: string;
	tokenTtlSeconds: number;
	expiresAt?: ISODateString;
	identityUserId: string;
	lastUsedAt?: ISODateString;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
	serviceUsername?: string;
	roleName?: string;
	environmentName?: string;
}

export interface CreateFederatedCredential {
	name: string;
	description?: string;
	enabled: boolean;
	issuerUrl: string;
	audiences: string[];
	subjectClaim: string;
	subjectMatch: string;
	matchType: string;
	roleId: string;
	environmentId?: string;
	tokenTtlSeconds: number;
	expiresAt?: ISODateString;
}

export interface UpdateFederatedCredential {
	name?: string;
	description?: string;
	enabled?: boolean;
	issuerUrl?: string;
	audiences?: string[];
	subjectClaim?: string;
	subjectMatch?: string;
	matchType?: string;
	roleId?: string;
	environmentId?: string;
	tokenTtlSeconds?: number;
	expiresAt?: ISODateString;
}
