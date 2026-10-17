/**
 * Port of ArcaneOIDC/OIDCAuthenticator.swift.
 *
 * The Arcane backend owns the OAuth protocol state: `oidc/url` returns an
 * authorization URL carrying the server-generated `state` and PKCE challenge,
 * and `oidc/callback` validates `state` and redeems the code with the stored
 * verifier. The client only presents the browser and hands back `code` +
 * `state`. Presenting the browser is injected (`AuthSessionPresenter`), e.g.
 * with `expo-web-browser`:
 *
 * ```ts
 * const oidc = new OIDCAuthenticator(client, {
 *   presentAuthSession: async (url, scheme) => {
 *     const result = await WebBrowser.openAuthSessionAsync(url, `${scheme}://`, {
 *       preferEphemeralSession: true,
 *     });
 *     if (result.type !== "success") throw new CancellationError(); // from the SDK
 *     return result.url;
 *   },
 * });
 * const { user } = await oidc.signIn({
 *   callbackURLScheme: "arcane-mobile",
 *   redirectURI: "arcane-mobile://oidc-callback",
 * });
 * ```
 */
import type { ArcaneClient } from '../client/ArcaneClient';
import { CancellationError } from '../errors/ArcaneError';
import { awaitAuthSession, type AuthSessionPresenter } from './authSession';
import { SignInError, type SignInResult } from './SignInTypes';
import { urlComponents } from './urlComponents';

export interface OIDCAuthenticatorOptions {
	/** Default browser for `signIn` / `signInWithAuthorizationURL`. */
	presentAuthSession: AuthSessionPresenter;
}

export class OIDCAuthenticator {
	static readonly SignInError = SignInError;

	private readonly client: ArcaneClient;
	private readonly presentAuthSession: AuthSessionPresenter;

	constructor(client: ArcaneClient, options: OIDCAuthenticatorOptions) {
		this.client = client;
		this.presentAuthSession = options.presentAuthSession;
	}

	/**
	 * Low-level entry point: the caller already has an authorization URL and
	 * wants to drive the OAuth flow directly. Resolves with the callback URL.
	 * (Swift `signIn(callbackURLScheme:authorizationURL:presenting:)`.)
	 */
	signInWithAuthorizationURL(args: {
		callbackURLScheme: string;
		authorizationURL: string;
		signal?: AbortSignal;
	}): Promise<string> {
		return awaitAuthSession(
			(sessionSignal) =>
				this.presentAuthSession(args.authorizationURL, args.callbackURLScheme, sessionSignal),
			{ signal: args.signal, missingCallback: SignInError.invalidCallbackURL }
		);
	}

	/**
	 * High-level orchestration: ask the backend for an auth URL, present it,
	 * then complete the callback with the backend. Tokens are persisted via the
	 * client's `AuthManager` on success. Throws `MFARequiredError` when the
	 * server requires a second factor.
	 *
	 * `browser` overrides the default presenter (Swift
	 * `signIn(callbackURLScheme:redirectURI:browser:)`, e.g. an app-owned
	 * browser that shares the proxy session).
	 */
	async signIn(args: {
		callbackURLScheme: string;
		redirectURI: string;
		browser?: (authorizationURL: string, callbackURLScheme: string) => Promise<string>;
		signal?: AbortSignal;
	}): Promise<SignInResult> {
		const response = await this.client.auth.oidcAuthURL({ mobileRedirectURI: args.redirectURI });
		const scheme = urlComponents(response.authUrl)?.scheme.toLowerCase();
		if (scheme !== 'https' && scheme !== 'http') {
			throw SignInError.invalidAuthorizationURL();
		}
		const browser = args.browser;
		const callbackURL = browser
			? await browser(response.authUrl, args.callbackURLScheme)
			: await this.signInWithAuthorizationURL({
					callbackURLScheme: args.callbackURLScheme,
					authorizationURL: response.authUrl,
					signal: args.signal
				});
		const callbackScheme = urlComponents(callbackURL)?.scheme;
		if (
			callbackScheme === undefined ||
			callbackScheme.toLowerCase() !== args.callbackURLScheme.toLowerCase()
		) {
			throw SignInError.invalidCallbackURL();
		}
		if (args.signal?.aborted) throw new CancellationError();
		return this.completeSignIn({ callbackURL, redirectURI: args.redirectURI });
	}

	/** Exchanges a callback URL's `code` + `state` with the backend. Swift-internal; public here. */
	async completeSignIn(args: { callbackURL: string; redirectURI: string }): Promise<SignInResult> {
		const { code, state } = OIDCAuthenticator.parseCallback(args.callbackURL);
		const response = await this.client.auth.oidcCallback({
			code,
			state,
			mobileRedirectURI: args.redirectURI
		});
		return {
			user: response.user,
			tokens: {
				accessToken: response.token,
				refreshToken: response.refreshToken,
				expiresAt: response.expiresAt
			}
		};
	}

	/** First `code` and `state` query values; throws `SignInError.missingCodeOrState`. */
	static parseCallback(url: string): { code: string; state: string } {
		const items = urlComponents(url)?.queryItems;
		const code = items?.find((item) => item.name === 'code')?.value;
		const state = items?.find((item) => item.name === 'state')?.value;
		if (code === undefined || state === undefined) {
			throw SignInError.missingCodeOrState();
		}
		return { code, state };
	}
}
