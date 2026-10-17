/** Port of Models/Auth/Passkey.swift. */
import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';

/** WebAuthn credential JSON (`PublicKeyCredential.toJSON()` shape). */
export type PasskeyCredential = Record<string, JSONValue>;

export interface PasskeyChallenge {
	ceremonyId: string;
	transactionId?: string;
	/** WebAuthn `publicKey` creation/request options. */
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

/** @internal */
export interface PasskeyFinishRequest {
	ceremonyId: string;
	credential: PasskeyCredential;
	name?: string;
}

/** @internal */
export interface MobilePasskeyExchangeRequest {
	transactionId: string;
	codeVerifier: string;
}

/** @internal */
export interface MFAStartRequest {
	transactionId: string;
}

/** @internal */
export interface MFAFinishRequest {
	transactionId: string;
	credential: PasskeyCredential;
}

/** @internal */
export interface RecoveryCodeRequest {
	transactionId: string;
	code: string;
}

/** @internal */
export interface RenamePasskeyRequest {
	name: string;
}

/** @internal */
export interface PasswordStepUpRequest {
	password: string;
}
