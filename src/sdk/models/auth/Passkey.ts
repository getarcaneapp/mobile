import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';

export type PasskeyCredential = Record<string, JSONValue>;

export interface PasskeyChallenge {
	ceremonyId: string;
	transactionId?: string;
	options: Record<string, JSONValue>;
	expiresAt: ISODateString;
}

export interface PasskeySummary {
	id: string;
	name: string;
	rpId: string;
	aaguid?: string;
	transports?: string[];
	backupEligible: boolean;
	backupState: boolean;
	cloneWarning: boolean;
	authenticatorAttachment?: string;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
	lastUsedAt?: ISODateString;
}

export interface PasskeyCapabilities {
	passkeyMfaEnabled: boolean;
	passkeyCount: number;
	hasLocalPassword: boolean;
	hasOidcFallback: boolean;
	canEnrollWithActiveSession: boolean;
	canDeleteLastPasskey: boolean;
	requiresStepUp: boolean;
}

export interface MFAStatus {
	enabled: boolean;
	passkeyCount: number;
	recoveryCodesRemaining: number;
}

export interface RecoveryCodesResponse {
	codes: string[];
}

export interface StepUpGrant {
	token: string;
	expiresAt: ISODateString;
}

export interface PasskeyFinishRequest {
	ceremonyId: string;
	credential: PasskeyCredential;
	name?: string;
}

export interface MobilePasskeyExchangeRequest {
	transactionId: string;
	codeVerifier: string;
}

export interface MFAStartRequest {
	transactionId: string;
}

export interface MFAFinishRequest {
	transactionId: string;
	credential: PasskeyCredential;
}

export interface RecoveryCodeRequest {
	transactionId: string;
	code: string;
}

export interface RenamePasskeyRequest {
	name: string;
}

export interface PasswordStepUpRequest {
	password: string;
}
