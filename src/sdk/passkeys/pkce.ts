/**
 * Request state and PKCE (RFC 7636, S256) helpers. Port of
 * `ArcanePasskeyAuthenticator.makeState()` / `codeChallenge(for:)`.
 *
 * Randomness and SHA-256 are injected so the app can pass `expo-crypto`
 * (`getRandomBytes`, `digest(CryptoDigestAlgorithm.SHA256, …)`).
 */
import { encodeUTF8 } from '../http/json';
import { base64URLEncode } from './base64url';

/** Cryptographically secure random bytes (e.g. `expo-crypto`'s `getRandomBytes`). */
export type RandomBytes = (count: number) => Uint8Array;

/** SHA-256 digest (e.g. `expo-crypto`'s `digest`, or `crypto.subtle.digest`). */
export type SHA256 = (data: Uint8Array) => Promise<Uint8Array>;

/** Number of random bytes behind every state / code verifier (43 base64url chars). */
export const STATE_BYTE_COUNT = 32;

/** Thrown when `randomBytes` fails or returns the wrong number of bytes. */
export class RandomGenerationError extends Error {
	constructor() {
		super('Secure random bytes could not be generated.');
		this.name = 'RandomGenerationError';
	}
}

/** 32 random bytes, base64url-encoded: an unguessable request state. */
export function makeState(randomBytes: RandomBytes): string {
	let bytes: Uint8Array;
	try {
		bytes = randomBytes(STATE_BYTE_COUNT);
	} catch {
		throw new RandomGenerationError();
	}
	if (bytes.length !== STATE_BYTE_COUNT) throw new RandomGenerationError();
	return base64URLEncode(bytes);
}

/** A PKCE code verifier (43 chars from the unreserved set). Same as `makeState`. */
export function makeCodeVerifier(randomBytes: RandomBytes): string {
	return makeState(randomBytes);
}

/** PKCE S256 challenge: `base64url(SHA256(ASCII(verifier)))`. */
export async function codeChallenge(verifier: string, sha256: SHA256): Promise<string> {
	return base64URLEncode(await sha256(encodeUTF8(verifier)));
}
