import assert from 'node:assert/strict';
import { describe, test } from 'vite-plus/test';

import { CancellationError } from '../errors/ArcaneError';
import { awaitAuthSession } from '../oidc/authSession';
import { OIDCAuthenticator } from '../oidc/OIDCAuthenticator';
import { SignInError } from '../oidc/SignInTypes';
import { ArcanePasskeyAuthenticator } from '../passkeys/ArcanePasskeyAuthenticator';
import { base64URLDecode, base64URLEncode } from '../passkeys/base64url';
import { CeremonyError } from '../passkeys/CeremonyTypes';
import {
	codeChallenge,
	makeCodeVerifier,
	makeState,
	RandomGenerationError
} from '../passkeys/pkce';

const sha256 = async (data: Uint8Array): Promise<Uint8Array> =>
	new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(data)));

const utf8 = (text: string) => new TextEncoder().encode(text);

describe('base64url', () => {
	test('encodes RFC 4648 vectors without padding', () => {
		const vectors: [string, string][] = [
			['', ''],
			['f', 'Zg'],
			['fo', 'Zm8'],
			['foo', 'Zm9v'],
			['foob', 'Zm9vYg'],
			['fooba', 'Zm9vYmE'],
			['foobar', 'Zm9vYmFy']
		];
		for (const [plain, encoded] of vectors) {
			assert.equal(base64URLEncode(utf8(plain)), encoded);
			assert.deepEqual(base64URLDecode(encoded), utf8(plain));
		}
	});

	test('uses the URL-safe alphabet', () => {
		const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
		assert.equal(base64URLEncode(bytes), '-_-_');
		assert.deepEqual(base64URLDecode('-_-_'), bytes);
	});

	test('round-trips every byte value', () => {
		const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
		for (let length = 0; length <= bytes.length; length += 17) {
			const slice = bytes.slice(0, length);
			assert.deepEqual(base64URLDecode(base64URLEncode(slice)), slice);
		}
	});

	test('rejects padding, standard alphabet and impossible lengths', () => {
		assert.equal(base64URLDecode('Zg=='), undefined);
		assert.equal(base64URLDecode('+/+/'), undefined);
		assert.equal(base64URLDecode('Zm9vY'), undefined);
		assert.equal(base64URLDecode('Zm 9v'), undefined);
	});
});

describe('PKCE', () => {
	test('S256 challenge matches RFC 7636 appendix B', async () => {
		const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
		assert.equal(
			await codeChallenge(verifier, sha256),
			'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
		);
	});

	test('state and verifier are 32 random bytes as 43 base64url chars', () => {
		const requested: number[] = [];
		const randomBytes = (count: number) => {
			requested.push(count);
			return crypto.getRandomValues(new Uint8Array(count));
		};
		const state = makeState(randomBytes);
		const verifier = makeCodeVerifier(randomBytes);
		assert.deepEqual(requested, [32, 32]);
		for (const value of [state, verifier]) {
			assert.match(value, /^[A-Za-z0-9_-]{43}$/);
		}
		assert.notEqual(state, verifier);
	});

	test('random source failures are reported', () => {
		assert.throws(() => makeState(() => new Uint8Array(4)), RandomGenerationError);
		assert.throws(
			() =>
				makeState(() => {
					throw new Error('no entropy');
				}),
			RandomGenerationError
		);
	});
});

describe('passkey bridge callbacks', () => {
	const state = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
	const encode = (json: string) => base64URLEncode(utf8(json));

	const assertCeremonyError = (fn: () => unknown, expected: CeremonyError) =>
		assert.throws(fn, (error: unknown) => error instanceof CeremonyError && error.equals(expected));

	test('parses an exact success callback', () => {
		const response = encode('{"id":"credential","type":"public-key"}');
		const parsed = ArcanePasskeyAuthenticator.parseCallback(
			`arcane-mobile://passkey-callback?state=${state}&response=${response}`,
			state
		);
		assert.equal(parsed['id'], 'credential');
	});

	test('parses a backend mobile-login callback', () => {
		const transactionId = ArcanePasskeyAuthenticator.parseMobileLoginCallback(
			`arcane-mobile://passkey-callback?state=${state}&transaction=transaction-1`,
			state
		);
		assert.equal(transactionId, 'transaction-1');
	});

	test('rejects wrong state, origin and duplicate items', () => {
		const response = encode('{"id":"credential"}');
		assertCeremonyError(
			() =>
				ArcanePasskeyAuthenticator.parseCallback(
					`arcane-mobile://passkey-callback?state=wrong&response=${response}`,
					state
				),
			CeremonyError.stateMismatch()
		);
		assertCeremonyError(
			() =>
				ArcanePasskeyAuthenticator.parseCallback(
					`https://example.com/passkey-callback?state=${state}&response=${response}`,
					state
				),
			CeremonyError.invalidCallback()
		);
		assertCeremonyError(
			() =>
				ArcanePasskeyAuthenticator.parseCallback(
					`arcane-mobile://passkey-callback?state=${state}&state=${state}&response=${response}`,
					state
				),
			CeremonyError.duplicateCallbackItem()
		);
		assertCeremonyError(
			() =>
				ArcanePasskeyAuthenticator.parseCallback(
					`arcane-mobile://passkey-callback/?state=${state}&response=${response}`,
					state
				),
			CeremonyError.invalidCallback()
		);
	});

	test('maps bridge errors', () => {
		assertCeremonyError(
			() =>
				ArcanePasskeyAuthenticator.parseCallback(
					`arcane-mobile://passkey-callback?state=${state}&error=cancelled`,
					state
				),
			CeremonyError.cancelled()
		);
		assertCeremonyError(
			() =>
				ArcanePasskeyAuthenticator.parseCallback(
					`arcane-mobile://passkey-callback?state=${state}&error=failed`,
					state
				),
			CeremonyError.bridgeFailure('failed')
		);
		assertCeremonyError(
			() =>
				ArcanePasskeyAuthenticator.parseCallback(
					`arcane-mobile://passkey-callback?state=${state}&error=bogus`,
					state
				),
			CeremonyError.invalidCallback()
		);
	});

	test('rejects non-object credentials', () => {
		assertCeremonyError(
			() =>
				ArcanePasskeyAuthenticator.parseCallback(
					`arcane-mobile://passkey-callback?state=${state}&response=${encode('[1]')}`,
					state
				),
			CeremonyError.invalidCredential()
		);
	});

	test('accepts HTTPS and loopback HTTP origins only', () => {
		assert.equal(
			ArcanePasskeyAuthenticator.serverOrigin('https://arcane.example/api'),
			'https://arcane.example/'
		);
		assert.equal(
			ArcanePasskeyAuthenticator.serverOrigin('http://127.0.0.1:3552/api'),
			'http://127.0.0.1:3552/'
		);
		assert.equal(ArcanePasskeyAuthenticator.serverOrigin('http://arcane.example/api'), undefined);
	});
});

describe('OIDC', () => {
	test('parses code and state from the callback', () => {
		assert.deepEqual(
			OIDCAuthenticator.parseCallback('arcane-mobile://oidc-callback?code=abc&state=xyz'),
			{
				code: 'abc',
				state: 'xyz'
			}
		);
		assert.throws(
			() => OIDCAuthenticator.parseCallback('arcane-mobile://oidc-callback?code=abc'),
			(error: unknown) => error instanceof SignInError && error.kind === 'missingCodeOrState'
		);
	});

	test('sign-in errors have useful descriptions', () => {
		assert.equal(
			SignInError.invalidAuthorizationURL().errorDescription,
			'Arcane returned an invalid OIDC authorization URL.'
		);
		assert.equal(
			SignInError.invalidCallbackURL().errorDescription,
			'The identity provider did not return an OIDC callback URL.'
		);
	});

	test('auth session maps a missing callback and cancellation', async () => {
		await assert.rejects(
			awaitAuthSession(async () => undefined, { missingCallback: SignInError.invalidCallbackURL }),
			(error: unknown) => error instanceof SignInError && error.kind === 'invalidCallbackURL'
		);

		const controller = new AbortController();
		controller.abort();
		let started = 0;
		await assert.rejects(
			awaitAuthSession(
				async () => {
					started += 1;
					return 'x://y';
				},
				{ signal: controller.signal, missingCallback: SignInError.invalidCallbackURL }
			),
			CancellationError
		);
		assert.equal(started, 0);

		const live = new AbortController();
		let sessionCancelled = false;
		const pending = awaitAuthSession(
			(signal) =>
				new Promise<string>(() => {
					signal.addEventListener('abort', () => {
						sessionCancelled = true;
					});
				}),
			{ signal: live.signal, missingCallback: SignInError.invalidCallbackURL }
		);
		live.abort();
		await assert.rejects(pending, CancellationError);
		assert.equal(sessionCancelled, true);
	});
});
