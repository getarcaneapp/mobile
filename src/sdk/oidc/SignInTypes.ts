/** Port of ArcaneOIDC/Types/SignInTypes.swift (`OIDCAuthenticator.SignInResult` / `SignInError`). */
import type { TokenPair } from '../auth/TokenStore';
import type { User } from '../models/user/User';

export interface SignInResult {
	user: User;
	tokens: TokenPair;
}

export type SignInErrorKind =
	| 'invalidAuthorizationURL'
	| 'invalidCallbackURL'
	| 'missingCodeOrState'
	| 'sessionDidNotStart';

const descriptions: Record<SignInErrorKind, string> = {
	invalidAuthorizationURL: 'Arcane returned an invalid OIDC authorization URL.',
	invalidCallbackURL: 'The identity provider did not return an OIDC callback URL.',
	missingCodeOrState: 'The OIDC callback did not include the required code and state.',
	sessionDidNotStart: 'The secure sign-in session could not be started.'
};

/** Swift `OIDCAuthenticator.SignInError`; `message` is the Swift `errorDescription`. */
export class SignInError extends Error {
	readonly kind: SignInErrorKind;

	constructor(kind: SignInErrorKind) {
		super(descriptions[kind]);
		this.name = `SignInError.${kind}`;
		this.kind = kind;
	}

	get errorDescription(): string {
		return this.message;
	}

	equals(other: SignInError): boolean {
		return this.kind === other.kind;
	}

	static invalidAuthorizationURL(this: void): SignInError {
		return new SignInError('invalidAuthorizationURL');
	}
	static invalidCallbackURL(this: void): SignInError {
		return new SignInError('invalidCallbackURL');
	}
	static missingCodeOrState(this: void): SignInError {
		return new SignInError('missingCodeOrState');
	}
	static sessionDidNotStart(this: void): SignInError {
		return new SignInError('sessionDidNotStart');
	}
}
