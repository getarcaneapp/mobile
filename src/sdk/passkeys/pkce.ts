import { encodeUTF8 } from '../http/json';
import { base64URLEncode } from './base64url';

export type RandomBytes = (count: number) => Uint8Array;

export type SHA256 = (data: Uint8Array) => Promise<Uint8Array>;

export const STATE_BYTE_COUNT = 32;

export class RandomGenerationError extends Error {
	constructor() {
		super('Secure random bytes could not be generated.');
		this.name = 'RandomGenerationError';
	}
}

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

export function makeCodeVerifier(randomBytes: RandomBytes): string {
	return makeState(randomBytes);
}

export async function codeChallenge(verifier: string, sha256: SHA256): Promise<string> {
	return base64URLEncode(await sha256(encodeUTF8(verifier)));
}
