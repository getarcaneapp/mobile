import {
	ArcaneError,
	CancellationError,
	arcaneErrorFrom,
	isArcaneError,
	normalizedTransportError
} from '../errors/ArcaneError';
import {
	LoginResponse,
	TokenRefreshResponse,
	type AuthenticationResult
} from '../models/auth/Login';
import { timeIntervalSinceNow } from '../models/base/date';
import type { User } from '../models/user/User';
import { ProxyRequestSupport, type PreparedRequest } from '../client/proxyRequestSupport';
import { ServerCapabilities } from '../client/ServerCapabilities';
import { appendingAPIPath } from '../client/url';
import { DEFAULT_REQUEST_TIMEOUT_MS, readText, send, type FetchLike } from '../http/fetching';
import { encodeArcaneJSON, parseArcaneJSON } from '../http/json';
import type { ArcaneProxySession } from '../types/proxySession';
import type { TokenPair, TokenStore } from './TokenStore';

export interface AuthenticationContext {
	headers: Record<string, string>;
	credentialGeneration: number | undefined;
}

export interface AuthManagerConfig {
	baseURL: string;
	tokenStore: TokenStore;
	apiKey?: string;
	fetch: FetchLike;
	additionalHeaders?: Record<string, string>;
	proxySession?: ArcaneProxySession;
	timeoutMs?: number;
	now?: () => number;
}

interface RefreshTask {
	promise: Promise<TokenPair>;
	controller: AbortController;
}

export class AuthManager {
	static readonly expirySkew = 45;
	static readonly failedProactiveRefreshBackoff = 30;

	private readonly baseURL: string;
	private readonly tokenStore: TokenStore;
	private readonly apiKey: string | undefined;
	private readonly fetchImpl: FetchLike;
	private readonly proxySupport: ProxyRequestSupport;
	private readonly timeoutMs: number;
	private readonly now: () => number;
	private cachedTokens: TokenPair | undefined;
	private refreshTask: RefreshTask | undefined;
	private capabilities: ServerCapabilities = ServerCapabilities.unknown;
	private lastFailedProactiveRefresh: number | undefined;
	private credentialGeneration = 0;
	private persistenceTask: Promise<void> | undefined;

	constructor(config: AuthManagerConfig) {
		this.baseURL = config.baseURL;
		this.tokenStore = config.tokenStore;
		this.apiKey = config.apiKey;
		this.fetchImpl = config.fetch;
		this.timeoutMs = config.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
		this.now = config.now ?? Date.now;
		this.proxySupport = new ProxyRequestSupport(
			config.baseURL,
			config.additionalHeaders ?? {},
			config.proxySession
		);
	}

	async authenticationHeaders(): Promise<Record<string, string>> {
		return (await this.authenticationContext()).headers;
	}

	async authenticationContext(): Promise<AuthenticationContext> {
		if (this.apiKey !== undefined && this.apiKey !== '') {
			return { headers: { 'X-API-Key': this.apiKey }, credentialGeneration: undefined };
		}
		if (this.cachedTokens === undefined) {
			const generation = this.credentialGeneration;
			const stored = await this.tokenStore.loadTokens();
			this.checkAuthenticationOperation(generation);
			this.cachedTokens = stored;
		}
		const tokens = this.cachedTokens;
		const lastFailed = this.lastFailedProactiveRefresh;
		if (
			tokens !== undefined &&
			tokens.refreshToken !== '' &&
			timeIntervalSinceNow(tokens.expiresAt, this.now()) < AuthManager.expirySkew &&
			(lastFailed === undefined ||
				(this.now() - lastFailed) / 1000 > AuthManager.failedProactiveRefreshBackoff)
		) {
			const generation = this.credentialGeneration;
			try {
				const refreshed = await this.refreshTokens();
				this.checkAuthenticationOperation(generation);
				this.cachedTokens = refreshed;
				this.lastFailedProactiveRefresh = undefined;
			} catch {
				this.checkAuthenticationOperation(generation);
				this.lastFailedProactiveRefresh = this.now();
			}
		}
		const accessToken = this.cachedTokens?.accessToken;
		if (accessToken === undefined || accessToken === '') {
			return { headers: {}, credentialGeneration: undefined };
		}
		return {
			headers: { Authorization: `Bearer ${accessToken}` },
			credentialGeneration: this.credentialGeneration
		};
	}

	currentAuthorizationHeader(): string | undefined {
		const accessToken = this.cachedTokens?.accessToken;
		if ((this.apiKey ?? '') !== '' || accessToken === undefined || accessToken === '') {
			return undefined;
		}
		return `Bearer ${accessToken}`;
	}

	async hasRefreshCredential(): Promise<boolean> {
		if (this.apiKey !== undefined) return false;
		if (this.cachedTokens === undefined) {
			const generation = this.credentialGeneration;
			const stored = await this.tokenStore.loadTokens();
			this.checkAuthenticationOperation(generation);
			this.cachedTokens = stored;
		}
		return (this.cachedTokens?.refreshToken ?? '') !== '';
	}

	async saveLoginResponse(loginResponse: LoginResponse): Promise<void> {
		await this.saveTokens({
			accessToken: loginResponse.token,
			refreshToken: loginResponse.refreshToken,
			expiresAt: loginResponse.expiresAt
		});
	}

	retirePendingAuthenticationOperations(): void {
		this.credentialGeneration += 1;
		this.refreshTask?.controller.abort();
		this.refreshTask = undefined;
	}

	async beginAuthenticationOperation(): Promise<number> {
		this.retirePendingAuthenticationOperations();
		const generation = this.credentialGeneration;
		if (this.cachedTokens === undefined) {
			const stored = await this.tokenStore.loadTokens();
			this.checkAuthenticationOperation(generation);
			this.cachedTokens = stored;
		}
		return generation;
	}

	checkAuthenticationOperation(generation: number, signal?: AbortSignal): void {
		if (signal?.aborted) throw new CancellationError();
		if (generation !== this.credentialGeneration) throw new CancellationError();
	}

	async saveAuthenticationResult(result: AuthenticationResult, generation: number): Promise<void> {
		this.checkAuthenticationOperation(generation);
		if (result.kind !== 'authenticated') return;
		const response = result.value;
		const tokens: TokenPair = {
			accessToken: response.token,
			refreshToken: response.refreshToken,
			expiresAt: response.expiresAt
		};
		await this.persist(tokens, generation);
		this.checkAuthenticationOperation(generation);
		this.cachedTokens = tokens;
		this.credentialGeneration += 1;
		this.recordCapabilities(response.user);
	}

	async saveTokensForUser(tokens: TokenPair, user: User, generation: number): Promise<void> {
		this.checkAuthenticationOperation(generation);
		await this.persist(tokens, generation);
		this.checkAuthenticationOperation(generation);
		this.cachedTokens = tokens;
		this.credentialGeneration += 1;
		this.recordCapabilities(user);
	}

	async saveTokens(tokens: TokenPair): Promise<void> {
		this.retirePendingAuthenticationOperations();
		const generation = this.credentialGeneration;
		this.cachedTokens = tokens;
		await this.persist(tokens, generation);
	}

	async clear(): Promise<void> {
		this.retirePendingAuthenticationOperations();
		const generation = this.credentialGeneration;
		this.cachedTokens = undefined;
		this.capabilities = ServerCapabilities.unknown;
		await this.persist(undefined, generation);
	}

	private persist(tokens: TokenPair | undefined, generation: number): Promise<void> {
		const previous = this.persistenceTask;
		const task = (async () => {
			if (previous) await previous.catch(() => undefined);
			this.checkAuthenticationOperation(generation);
			try {
				if (tokens !== undefined) await this.tokenStore.saveTokens(tokens);
				else await this.tokenStore.clearTokens();
				this.checkAuthenticationOperation(generation);
			} catch (error) {
				try {
					await this.restoreAcceptedCredentials();
				} catch {}
				throw error;
			}
		})();
		this.persistenceTask = task;
		return task;
	}

	private async restoreAcceptedCredentials(): Promise<void> {
		if (this.cachedTokens !== undefined) await this.tokenStore.saveTokens(this.cachedTokens);
		else await this.tokenStore.clearTokens();
	}

	currentCredentialGeneration(): number {
		return this.credentialGeneration;
	}

	async clearIfCredentialGenerationMatches(generation: number): Promise<void> {
		if (generation !== this.credentialGeneration) return;
		await this.clear();
	}

	currentCapabilities(): ServerCapabilities {
		return {
			mode: this.capabilities.mode,
			enabledFeatures: new Set(this.capabilities.enabledFeatures)
		};
	}

	recordCapabilities(user: User): void {
		const detected = ServerCapabilities.detect(user);
		if (detected === 'unknown') return;
		this.capabilities = { mode: detected, enabledFeatures: this.capabilities.enabledFeatures };
	}

	recordEnabledFeatures(features: readonly string[]): void {
		this.capabilities = {
			mode: this.capabilities.mode,
			enabledFeatures: new Set(features.map((feature) => feature.toLowerCase()))
		};
	}

	refreshTokens(): Promise<TokenPair> {
		return this.refreshTokensInternal(false);
	}

	private inFlightRefresh(): RefreshTask | undefined {
		return this.refreshTask;
	}

	private async refreshTokensInternal(isRetry: boolean): Promise<TokenPair> {
		if (this.refreshTask) return this.refreshTask.promise;
		const readGeneration = this.credentialGeneration;
		let stored: TokenPair | undefined;
		try {
			stored = await this.tokenStore.loadTokens();
		} catch {
			stored = undefined;
		}
		if (stored !== undefined) {
			this.checkAuthenticationOperation(readGeneration);
			this.cachedTokens = stored;
		} else if (this.cachedTokens === undefined) {
			const generation = this.credentialGeneration;
			const reloaded = await this.tokenStore.loadTokens();
			this.checkAuthenticationOperation(generation);
			this.cachedTokens = reloaded;
		}
		this.checkAuthenticationOperation(readGeneration);
		const joined = this.inFlightRefresh();
		if (joined) return joined.promise;

		const refreshToken = this.cachedTokens?.refreshToken;
		if (refreshToken === undefined || refreshToken === '') throw ArcaneError.unauthorized();
		const generation = this.credentialGeneration;

		const controller = new AbortController();
		const task: RefreshTask = {
			controller,
			promise: this.performRefreshAndPersist(refreshToken, generation, controller.signal)
		};
		task.promise.catch(() => undefined);
		this.refreshTask = task;

		try {
			const tokens = await task.promise;
			if (generation === this.credentialGeneration) this.refreshTask = undefined;
			return tokens;
		} catch (error) {
			if (generation === this.credentialGeneration) this.refreshTask = undefined;
			if (error instanceof CancellationError || generation !== this.credentialGeneration) {
				throw new CancellationError();
			}
			return this.handleRefreshFailure(error, refreshToken, isRetry, generation);
		}
	}

	private async handleRefreshFailure(
		error: unknown,
		rejectedRefreshToken: string,
		isRetry: boolean,
		generation: number
	): Promise<TokenPair> {
		if (!isArcaneError(error, 'unauthorized') && !isArcaneError(error, 'forbidden')) throw error;

		if (!isRetry) {
			const latest = await this.tokenStore.loadTokens().catch(() => undefined);
			if (
				latest !== undefined &&
				latest.refreshToken !== '' &&
				latest.refreshToken !== rejectedRefreshToken
			) {
				this.checkAuthenticationOperation(generation);
				this.cachedTokens = latest;
				return this.refreshTokensInternal(true);
			}
		}

		const current = await this.tokenStore.loadTokens().catch(() => undefined);
		if (current !== undefined && current.refreshToken === rejectedRefreshToken) {
			await this.clearIfCredentialGenerationMatches(generation).catch(() => undefined);
		}
		throw error;
	}

	private async performRefreshAndPersist(
		refreshToken: string,
		generation: number,
		signal: AbortSignal
	): Promise<TokenPair> {
		const tokens = await this.performRefreshRequest(refreshToken, signal);
		this.checkAuthenticationOperation(generation, signal);
		await this.persist(tokens, generation);
		this.checkAuthenticationOperation(generation, signal);
		this.cachedTokens = tokens;
		return tokens;
	}

	private async performRefreshRequest(
		refreshToken: string,
		signal: AbortSignal
	): Promise<TokenPair> {
		const request: PreparedRequest = {
			url: appendingAPIPath(this.baseURL, 'auth/refresh'),
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			handleCookies: true
		};
		try {
			const delegate = await this.proxySupport.prepare(request);
			const { response, info, release } = await send(this.fetchImpl, request, {
				body: encodeArcaneJSON({ refreshToken }),
				signal,
				timeoutMs: this.timeoutMs
			});
			try {
				const text = await readText(response, signal);
				await delegate.receive(info);
				this.proxySupport.check(info, text);
				if (response.status < 200 || response.status >= 300) {
					throw arcaneErrorFrom(response.status, text, response.headers);
				}
				let refreshed: TokenRefreshResponse;
				try {
					const envelope = parseArcaneJSON(text) as { data?: unknown } | undefined;
					refreshed = TokenRefreshResponse.decode(envelope?.data);
				} catch (error) {
					throw ArcaneError.decoding(String(error));
				}
				return {
					accessToken: refreshed.token,
					refreshToken: refreshed.refreshToken,
					expiresAt: refreshed.expiresAt
				};
			} finally {
				release();
			}
		} catch (error) {
			if (error instanceof ArcaneError) throw error;
			throw normalizedTransportError(error);
		}
	}
}
