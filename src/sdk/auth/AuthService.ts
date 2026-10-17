/** Port of Auth/AuthService.swift. */
import type { ArcaneTransport } from '../client/ArcaneTransport';
import { AuthenticationResult, MFARequiredError, type LoginResponse } from '../models/auth/Login';
import {
	OIDCDeviceTokenResponse,
	type OIDCAuthURLResponse,
	type OIDCCallbackResponse,
	type OIDCConfigResponse,
	type OIDCDeviceAuthResponse,
	type OIDCStatusInfo
} from '../models/auth/OIDC';
import { MessageResponse } from '../models/base/message';
import { User } from '../models/user/User';
import type { AuthManager } from './AuthManager';
import type { TokenPair } from './TokenStore';

export class AuthService {
	private readonly transport: ArcaneTransport;
	private readonly authManager: AuthManager;

	/** @internal */
	constructor(transport: ArcaneTransport, authManager: AuthManager) {
		this.transport = transport;
		this.authManager = authManager;
	}

	/** Throws `MFARequiredError` when a second factor is required. */
	async login(args: { username: string; password: string }): Promise<LoginResponse> {
		const result = await this.authenticate(args);
		if (result.kind === 'mfaRequired') throw new MFARequiredError(result.value);
		return result.value;
	}

	async authenticate(args: { username: string; password: string }): Promise<AuthenticationResult> {
		const generation = await this.authManager.beginAuthenticationOperation();
		const result = await this.transport.request('auth/login', {
			method: 'POST',
			body: { username: args.username, password: args.password },
			authorized: false,
			decode: AuthenticationResult.decode
		});
		await this.authManager.saveAuthenticationResult(result, generation);
		return result;
	}

	async logout(): Promise<void> {
		const generation = this.authManager.currentCredentialGeneration();
		let remoteError: unknown;
		try {
			await this.transport.request('auth/logout', {
				method: 'POST',
				decode: MessageResponse.decode
			});
		} catch (error) {
			remoteError = error;
		}
		// Local credential removal is the security-critical outcome. If both
		// operations fail, report this failure rather than the revocation error.
		await this.authManager.clearIfCredentialGenerationMatches(generation);
		if (remoteError !== undefined) throw remoteError;
	}

	async me(): Promise<User> {
		const user = await this.transport.request('auth/me', { decode: User.decode });
		this.authManager.recordCapabilities(user);
		return user;
	}

	refresh(): Promise<TokenPair> {
		return this.authManager.refreshTokens();
	}

	async changePassword(args: { currentPassword?: string; newPassword: string }): Promise<void> {
		await this.transport.request('auth/password', {
			method: 'POST',
			body: { currentPassword: args.currentPassword, newPassword: args.newPassword },
			decode: MessageResponse.decode
		});
	}

	// MARK: - OIDC
	// The OIDC endpoints return their body directly (no `{ success, data }`
	// envelope), so they use `rawRequest` and decode the body themselves.

	async oidcStatus(): Promise<OIDCStatusInfo> {
		const text = await this.transport.rawRequest('oidc/status', { authorized: false });
		return this.transport.decode<OIDCStatusInfo>(text);
	}

	async oidcConfig(): Promise<OIDCConfigResponse> {
		const text = await this.transport.rawRequest('oidc/config', { authorized: false });
		return this.transport.decode<OIDCConfigResponse>(text);
	}

	async oidcAuthURL(args: {
		mobileRedirectURI: string;
		redirectTo?: string;
	}): Promise<OIDCAuthURLResponse> {
		const text = await this.transport.rawRequest('oidc/url', {
			method: 'POST',
			body: { redirectUri: args.redirectTo ?? '/', mobileRedirectUri: args.mobileRedirectURI },
			authorized: false
		});
		return this.transport.decode<OIDCAuthURLResponse>(text);
	}

	/** Throws `MFARequiredError` when a second factor is required. */
	async oidcCallback(args: {
		code: string;
		state: string;
		mobileRedirectURI: string;
	}): Promise<OIDCCallbackResponse> {
		const result = await this.authenticateOIDCCallback(args);
		if (result.kind === 'mfaRequired') throw new MFARequiredError(result.value);
		return {
			success: true,
			token: result.value.token,
			refreshToken: result.value.refreshToken,
			expiresAt: result.value.expiresAt,
			user: result.value.user
		};
	}

	async authenticateOIDCCallback(args: {
		code: string;
		state: string;
		mobileRedirectURI: string;
	}): Promise<AuthenticationResult> {
		const generation = await this.authManager.beginAuthenticationOperation();
		const text = await this.transport.rawRequest('oidc/callback', {
			method: 'POST',
			body: { code: args.code, state: args.state, mobileRedirectUri: args.mobileRedirectURI },
			authorized: false
		});
		const result = this.transport.decode(text, AuthenticationResult.decode);
		await this.authManager.saveAuthenticationResult(result, generation);
		return result;
	}

	async oidcDeviceCode(): Promise<OIDCDeviceAuthResponse> {
		const text = await this.transport.rawRequest('oidc/device/code', {
			method: 'POST',
			body: {},
			authorized: false
		});
		return this.transport.decode<OIDCDeviceAuthResponse>(text);
	}

	async oidcDeviceToken(args: { deviceCode: string }): Promise<OIDCDeviceTokenResponse> {
		const generation = await this.authManager.beginAuthenticationOperation();
		const text = await this.transport.rawRequest('oidc/device/token', {
			method: 'POST',
			body: { deviceCode: args.deviceCode },
			authorized: false
		});
		const response = this.transport.decode(text, OIDCDeviceTokenResponse.decode);
		await this.authManager.saveTokensForUser(
			{
				accessToken: response.token,
				refreshToken: response.refreshToken,
				expiresAt: response.expiresAt
			},
			response.user,
			generation
		);
		return response;
	}
}
