import { CryptoDigestAlgorithm, digest, getRandomBytes } from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import type { AuthSessionPresenter } from '@/sdk/oidc/authSession';
import type { ArcanePasskeyAuthenticatorOptions } from '@/sdk/passkeys/ArcanePasskeyAuthenticator';
import { CancellationError } from '@/sdk/errors/ArcaneError';

export const ArcaneMobileOIDC = {
	callbackURLScheme: 'arcane-mobile',
	redirectURI: 'arcane-mobile://oidc-callback'
} as const;

export const presentAuthSession: AuthSessionPresenter = async (url, callbackScheme, signal) => {
	const onAbort = () => {
		try {
			WebBrowser.dismissAuthSession();
		} catch {}
	};
	signal.addEventListener('abort', onAbort);
	try {
		const result = await WebBrowser.openAuthSessionAsync(url, `${callbackScheme}://`, {
			preferEphemeralSession: true
		});
		if (result.type === WebBrowser.WebBrowserResultType.LOCKED)
			throw new Error('Another sign-in window is already open. Close it and try again.');
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
