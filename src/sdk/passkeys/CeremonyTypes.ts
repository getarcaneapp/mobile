/** Port of ArcanePasskeys/Types/CeremonyTypes.swift (`ArcanePasskeyAuthenticator.CeremonyError` / `BridgeManifest`). */

export type CeremonyErrorKind =
	| 'unsupportedOrigin'
	| 'bridgeUnavailable'
	| 'invalidManifest'
	| 'requestTooLarge'
	| 'invalidCallback'
	| 'stateMismatch'
	| 'duplicateCallbackItem'
	| 'cancelled'
	| 'bridgeFailure'
	| 'invalidCredential'
	| 'sessionDidNotStart'
	| 'randomStateGenerationFailed';

function describe(kind: CeremonyErrorKind, code: string | undefined): string {
	switch (kind) {
		case 'unsupportedOrigin':
			return 'Passkeys require HTTPS or a loopback HTTP Arcane server.';
		case 'bridgeUnavailable':
			return 'This Arcane server does not provide the mobile passkey bridge.';
		case 'invalidManifest':
			return 'The Arcane mobile passkey bridge manifest is invalid.';
		case 'requestTooLarge':
			return 'The passkey request is too large.';
		case 'invalidCallback':
			return 'The passkey bridge returned an invalid callback.';
		case 'stateMismatch':
			return 'The passkey bridge callback did not match this request.';
		case 'duplicateCallbackItem':
			return 'The passkey bridge callback contains duplicate values.';
		case 'cancelled':
			return 'The passkey request was cancelled.';
		case 'bridgeFailure':
			return `The passkey bridge failed with ${code ?? ''}.`;
		case 'invalidCredential':
			return 'The passkey bridge returned an invalid credential.';
		case 'sessionDidNotStart':
			return 'The secure passkey session could not be started.';
		case 'randomStateGenerationFailed':
			return 'A secure passkey request state could not be created.';
	}
}

/**
 * Swift `ArcanePasskeyAuthenticator.CeremonyError`; `message` is the Swift
 * `errorDescription`. `code` carries the `bridgeFailure(String)` payload.
 */
export class CeremonyError extends Error {
	readonly kind: CeremonyErrorKind;
	readonly code: string | undefined;

	private constructor(kind: CeremonyErrorKind, code?: string) {
		super(describe(kind, code));
		this.name = `CeremonyError.${kind}`;
		this.kind = kind;
		this.code = code;
	}

	get errorDescription(): string {
		return this.message;
	}

	equals(other: CeremonyError): boolean {
		return this.kind === other.kind && this.code === other.code;
	}

	static unsupportedOrigin(this: void): CeremonyError {
		return new CeremonyError('unsupportedOrigin');
	}
	static bridgeUnavailable(this: void): CeremonyError {
		return new CeremonyError('bridgeUnavailable');
	}
	static invalidManifest(this: void): CeremonyError {
		return new CeremonyError('invalidManifest');
	}
	static requestTooLarge(this: void): CeremonyError {
		return new CeremonyError('requestTooLarge');
	}
	static invalidCallback(this: void): CeremonyError {
		return new CeremonyError('invalidCallback');
	}
	static stateMismatch(this: void): CeremonyError {
		return new CeremonyError('stateMismatch');
	}
	static duplicateCallbackItem(this: void): CeremonyError {
		return new CeremonyError('duplicateCallbackItem');
	}
	static cancelled(this: void): CeremonyError {
		return new CeremonyError('cancelled');
	}
	static bridgeFailure(this: void, code: string): CeremonyError {
		return new CeremonyError('bridgeFailure', code);
	}
	static invalidCredential(this: void): CeremonyError {
		return new CeremonyError('invalidCredential');
	}
	static sessionDidNotStart(this: void): CeremonyError {
		return new CeremonyError('sessionDidNotStart');
	}
	static randomStateGenerationFailed(this: void): CeremonyError {
		return new CeremonyError('randomStateGenerationFailed');
	}
}

/** `GET /arcane-mobile-passkey.json` on the server origin. */
export interface BridgeManifest {
	version: number;
	path: string;
	requestFragmentParameter: string;
	maximumRequestBytes: number;
}

export const BridgeManifest = {
	/** Strict decode (Swift synthesized `Decodable`); throws on a wrong shape. */
	decode(raw: unknown): BridgeManifest {
		if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
			throw new TypeError('Expected a bridge manifest object');
		}
		const o = raw as Record<string, unknown>;
		const integer = (key: string): number => {
			const value = o[key];
			if (typeof value !== 'number' || !Number.isInteger(value))
				throw new TypeError(`Invalid ${key}`);
			return value;
		};
		const string = (key: string): string => {
			const value = o[key];
			if (typeof value !== 'string') throw new TypeError(`Invalid ${key}`);
			return value;
		};
		return {
			version: integer('version'),
			path: string('path'),
			requestFragmentParameter: string('requestFragmentParameter'),
			maximumRequestBytes: integer('maximumRequestBytes')
		};
	}
} as const;
