/**
 * `ASWebAuthenticationSession` replacement for the SDK's OIDC and passkey
 * flows: an ephemeral in-app browser session that resolves with the
 * `arcane-mobile://…` callback URL.
 */
import { CryptoDigestAlgorithm, digest, getRandomBytes } from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import type { AuthSessionPresenter } from '@/sdk/oidc/authSession';
import type { ArcanePasskeyAuthenticatorOptions } from '@/sdk/passkeys/ArcanePasskeyAuthenticator';
import { CancellationError } from '@/sdk/errors/ArcaneError';

/** Must match `OIDC_MOBILE_REDIRECT_URIS` on the backend and the provider's redirect URIs. */
export const ArcaneMobileOIDC = {
	callbackURLScheme: 'arcane-mobile',
	redirectURI: 'arcane-mobile://oidc-callback'
} as const;

export const presentAuthSession: AuthSessionPresenter = async (url, callbackScheme, signal) => {
	const onAbort = () => {
		try {
			WebBrowser.dismissAuthSession();
		} catch {
			// Android Custom Tabs can't be dismissed programmatically (`dismissBrowser` is iOS-only).
		}
	};
	signal.addEventListener('abort', onAbort);
	try {
		const result = await WebBrowser.openAuthSessionAsync(url, `${callbackScheme}://`, {
			preferEphemeralSession: true
		});
		// Dismissed by the user (or by `signal`): Swift's `.canceledLogin`.
		if (result.type !== 'success') throw new CancellationError();
		return result.url;
	} finally {
		signal.removeEventListener('abort', onAbort);
	}
};

export const passkeyAuthenticatorOptions: ArcanePasskeyAuthenticatorOptions = {
	presentAuthSession,
	randomBytes: (count) => getRandomBytes(count),
	sha256: async (data) =>
		new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, data as Uint8Array<ArrayBuffer>))
};
