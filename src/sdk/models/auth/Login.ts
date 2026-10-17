/** Port of Models/Auth/Login.swift. */
import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';
import { D, DecodingError } from '../base/decoding';
import { User } from '../user/User';

export interface LoginRequest {
	username: string;
	password: string;
}

export interface LoginResponse {
	token: string;
	refreshToken: string;
	expiresAt: ISODateString;
	user: User;
}

export const LoginResponse = {
	decode(raw: unknown): LoginResponse {
		const o = D.object(raw, 'LoginResponse');
		return {
			token: D.string(o, 'token'),
			refreshToken: D.string(o, 'refreshToken'),
			expiresAt: D.string(o, 'expiresAt'),
			user: D.nested(o, 'user', User.decode)
		};
	}
} as const;

export interface MFAChallenge {
	transactionId: string;
	/** Defaults to `"passkey"`. */
	method: string;
	options: Record<string, JSONValue>;
	expiresAt: ISODateString;
}

export const MFAChallenge = {
	decode(this: void, raw: unknown): MFAChallenge {
		const o = D.object(raw, 'MFAChallenge');
		return {
			transactionId: D.string(o, 'transactionId'),
			method: D.optString(o, 'method') ?? 'passkey',
			options: D.optRecord(o, 'options', D.cast<JSONValue>) ?? {},
			expiresAt: D.string(o, 'expiresAt')
		};
	}
} as const;

/**
 * Swift `enum AuthenticationResult { case authenticated(LoginResponse); case mfaRequired(MFAChallenge) }`.
 * Associated-value enums map to `{ kind: <case name>, <label or "value">: payload }`.
 */
export type AuthenticationResult =
	| { kind: 'authenticated'; value: LoginResponse }
	| { kind: 'mfaRequired'; value: MFAChallenge };

export const AuthenticationResult = {
	authenticated(this: void, value: LoginResponse): AuthenticationResult {
		return { kind: 'authenticated', value };
	},
	mfaRequired(this: void, value: MFAChallenge): AuthenticationResult {
		return { kind: 'mfaRequired', value };
	},

	decode(this: void, raw: unknown): AuthenticationResult {
		const o = D.object(raw, 'AuthenticationResult');
		const status = D.optString(o, 'status');
		if (status !== undefined && status !== 'authenticated' && status !== 'mfa_required') {
			throw new DecodingError(`Unknown authentication status "${status}"`, 'status');
		}
		if (status === 'mfa_required') {
			const challenge =
				D.optNested(o, 'mfa', MFAChallenge.decode) ??
				D.optNested(o, 'challenge', MFAChallenge.decode);
			return { kind: 'mfaRequired', value: challenge ?? MFAChallenge.decode(o) };
		}
		return { kind: 'authenticated', value: LoginResponse.decode(o) };
	},

	encode(this: void, value: AuthenticationResult): Record<string, unknown> {
		if (value.kind === 'authenticated') {
			return {
				success: true,
				status: 'authenticated',
				token: value.value.token,
				refreshToken: value.value.refreshToken,
				expiresAt: value.value.expiresAt,
				user: User.encode(value.value.user)
			};
		}
		return { success: true, status: 'mfa_required', mfa: value.value };
	}
} as const;

/** Thrown by `login`/`oidcCallback` when the server requires a second factor. */
export class MFARequiredError extends Error {
	readonly challenge: MFAChallenge;
	constructor(challenge: MFAChallenge) {
		super('Multi-factor authentication is required.');
		this.name = 'MFARequiredError';
		this.challenge = challenge;
	}
}

export interface RefreshRequest {
	refreshToken: string;
}

export interface TokenRefreshResponse {
	token: string;
	refreshToken: string;
	expiresAt: ISODateString;
}

export const TokenRefreshResponse = {
	decode(raw: unknown): TokenRefreshResponse {
		const o = D.object(raw, 'TokenRefreshResponse');
		return {
			token: D.string(o, 'token'),
			refreshToken: D.string(o, 'refreshToken'),
			expiresAt: D.string(o, 'expiresAt')
		};
	}
} as const;

export interface PasswordChange {
	currentPassword?: string;
	newPassword: string;
}

export interface AutoLoginConfig {
	enabled: boolean;
	username: string;
}
