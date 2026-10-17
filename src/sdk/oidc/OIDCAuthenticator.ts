import type { ArcaneClient } from '../client/ArcaneClient';
import { CancellationError } from '../errors/ArcaneError';
import { awaitAuthSession, type AuthSessionPresenter } from './authSession';
import { SignInError, type SignInResult } from './SignInTypes';
import { urlComponents } from './urlComponents';

export interface OIDCAuthenticatorOptions {
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
