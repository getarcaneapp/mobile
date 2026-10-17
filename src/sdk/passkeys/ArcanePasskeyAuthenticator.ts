import type { ArcaneClient } from '../client/ArcaneClient';
import { parseURL } from '../client/url';
import { encodeArcaneJSON, encodeUTF8, decodeUTF8 } from '../http/json';
import type { FetchLike } from '../http/fetching';
import {
	MFARequiredError,
	type AuthenticationResult,
	type LoginResponse,
	type MFAChallenge
} from '../models/auth/Login';
import type {
	PasskeyChallenge,
	PasskeyCredential,
	PasskeySummary,
	StepUpGrant
} from '../models/auth/Passkey';
import type { JSONValue } from '../types/json';
import { awaitAuthSession, type AuthSessionPresenter } from '../oidc/authSession';
import { urlComponents } from '../oidc/urlComponents';
import { base64URLDecode, base64URLEncode } from './base64url';
import { BridgeManifest, CeremonyError } from './CeremonyTypes';
import { codeChallenge, makeState, type RandomBytes, type SHA256 } from './pkce';

type Operation = 'authenticate' | 'register';

interface MobileLoginRequest {
	ceremonyId: string;
	codeChallenge: string;
}

interface BridgeRequest {
	version: number;
	state: string;
	operation: Operation;
	options: Record<string, JSONValue>;
	mobileLogin?: MobileLoginRequest;
}

export interface ArcanePasskeyAuthenticatorOptions {
	presentAuthSession: AuthSessionPresenter;
	randomBytes: RandomBytes;
	sha256: SHA256;
	fetch?: FetchLike;
}

const manifestPath = '/arcane-mobile-passkey.json';
const bridgePath = '/mobile/passkey';
const callbackScheme = 'arcane-mobile';
const callbackHost = 'passkey-callback';
const localMaximumRequestBytes = 65_536;
const maximumManifestBytes = 4_096;
const maximumCallbackResponseBytes = 65_536;
const bridgeErrorCodes = new Set([
	'invalid_request',
	'oversized',
	'unsupported',
	'cancelled',
	'failed'
]);

export class ArcanePasskeyAuthenticator {
	static readonly CeremonyError = CeremonyError;

	private readonly client: ArcaneClient;
	private readonly presentAuthSession: AuthSessionPresenter;
	private readonly randomBytes: RandomBytes;
	private readonly sha256: SHA256;
	private readonly fetchImpl: FetchLike;
	private activeSession: AbortController | undefined;

	constructor(client: ArcaneClient, options: ArcanePasskeyAuthenticatorOptions) {
		this.client = client;
		this.presentAuthSession = options.presentAuthSession;
		this.randomBytes = options.randomBytes;
		this.sha256 = options.sha256;
		this.fetchImpl =
			options.fetch ??
			client.configuration.fetch ??
			((input, init) => (globalThis.fetch as unknown as FetchLike)(input, init));
	}

	async isBridgeAvailable(): Promise<boolean> {
		try {
			await this.loadBridgeManifest();
			return true;
		} catch {
			return false;
		}
	}

	async authenticateLogin(): Promise<AuthenticationResult> {
		const challenge = await this.client.passkeys.beginLogin();
		const codeVerifier = this.makeState();
		const transactionId = await this.performMobileLoginCeremony(challenge, codeVerifier);
		return this.client.passkeys.exchangeMobileLogin({ transactionId, codeVerifier });
	}

	async login(): Promise<LoginResponse> {
		return authenticatedResponse(await this.authenticateLogin());
	}

	async completeMFA(
		args: { challenge: MFAChallenge } | { transactionId: string }
	): Promise<LoginResponse> {
		const challenge =
			'challenge' in args
				? args.challenge
				: await this.client.passkeys.beginMFA({ transactionId: args.transactionId });
		const credential = await this.performCeremony('authenticate', challenge.options);
		const result = await this.client.passkeys.finishMFA({
			transactionId: challenge.transactionId,
			credential
		});
		return authenticatedResponse(result);
	}

	async register(args: { name?: string; stepUpToken?: string } = {}): Promise<PasskeySummary> {
		const challenge = await this.client.passkeys.beginRegistration({
			stepUpToken: args.stepUpToken
		});
		const credential = await this.performCeremony('register', challenge.options);
		return this.client.passkeys.finishRegistration({
			ceremonyId: challenge.ceremonyId,
			credential,
			name: args.name,
			stepUpToken: args.stepUpToken
		});
	}

	async stepUp(): Promise<StepUpGrant> {
		const challenge = await this.client.passkeys.beginStepUp();
		const transactionId = challenge.transactionId;
		if (transactionId === undefined) throw CeremonyError.invalidCredential();
		const credential = await this.performCeremony('authenticate', challenge.options);
		return this.client.passkeys.finishStepUp({ transactionId, credential });
	}

	cancel(): void {
		this.activeSession?.abort();
		this.activeSession = undefined;
	}

	private async performCeremony(
		operation: Operation,
		options: Record<string, JSONValue>
	): Promise<PasskeyCredential> {
		const state = this.makeState();
		const callbackURL = await this.openBridge({ version: 2, state, operation, options });
		return ArcanePasskeyAuthenticator.parseCallback(callbackURL, state);
	}

	private async performMobileLoginCeremony(
		challenge: PasskeyChallenge,
		codeVerifier: string
	): Promise<string> {
		const state = this.makeState();
		const callbackURL = await this.openBridge({
			version: 2,
			state,
			operation: 'authenticate',
			options: challenge.options,
			mobileLogin: {
				ceremonyId: challenge.ceremonyId,
				codeChallenge: await codeChallenge(codeVerifier, this.sha256)
			}
		});
		return ArcanePasskeyAuthenticator.parseMobileLoginCallback(callbackURL, state);
	}

	private async openBridge(request: BridgeRequest): Promise<string> {
		const manifest = await this.loadBridgeManifest();
		const data = encodeUTF8(encodeArcaneJSON(request));
		if (data.length > Math.min(manifest.maximumRequestBytes, localMaximumRequestBytes)) {
			throw CeremonyError.requestTooLarge();
		}
		const origin = ArcanePasskeyAuthenticator.serverOrigin(this.client.configuration.baseURL);
		if (origin === undefined) throw CeremonyError.unsupportedOrigin();
		const authorizationURL = `${origin}mobile/passkey#request=${base64URLEncode(data)}`;
		return this.openBridgeURL(authorizationURL);
	}

	private async loadBridgeManifest(): Promise<BridgeManifest> {
		const origin = ArcanePasskeyAuthenticator.serverOrigin(this.client.configuration.baseURL);
		if (origin === undefined) throw CeremonyError.unsupportedOrigin();

		const response = await this.fetchImpl(`${origin}${manifestPath.replace(/^\/+|\/+$/g, '')}`);
		const bytes = new Uint8Array(await response.arrayBuffer());
		if (response.status < 200 || response.status >= 300 || bytes.length > maximumManifestBytes) {
			throw CeremonyError.bridgeUnavailable();
		}

		let manifest: BridgeManifest;
		try {
			manifest = BridgeManifest.decode(JSON.parse(decodeUTF8(bytes)));
		} catch {
			throw CeremonyError.invalidManifest();
		}

		if (
			manifest.version !== 2 ||
			manifest.path !== bridgePath ||
			manifest.requestFragmentParameter !== 'request' ||
			manifest.maximumRequestBytes < 1 ||
			manifest.maximumRequestBytes > localMaximumRequestBytes
		) {
			throw CeremonyError.invalidManifest();
		}
		return manifest;
	}

	private async openBridgeURL(authorizationURL: string): Promise<string> {
		const session = new AbortController();
		this.activeSession = session;
		try {
			return await awaitAuthSession(
				(sessionSignal) => this.presentAuthSession(authorizationURL, callbackScheme, sessionSignal),
				{ signal: session.signal, missingCallback: CeremonyError.invalidCallback }
			);
		} finally {
			if (this.activeSession === session) this.activeSession = undefined;
		}
	}

	private makeState(): string {
		try {
			return makeState(this.randomBytes);
		} catch {
			throw CeremonyError.randomStateGenerationFailed();
		}
	}

	static parseCallback(url: string, expectedState: string): PasskeyCredential {
		const grouped = validatedCallbackItems(url, expectedState);

		const encodedResponse = grouped.get('response');
		if (
			!sameKeys(grouped, ['state', 'response']) ||
			encodedResponse === undefined ||
			encodeUTF8(encodedResponse).length > Math.floor((maximumCallbackResponseBytes * 4) / 3) + 4
		) {
			throw CeremonyError.invalidCallback();
		}
		const data = base64URLDecode(encodedResponse);
		if (data === undefined || data.length > maximumCallbackResponseBytes) {
			throw CeremonyError.invalidCallback();
		}

		let credential: unknown;
		try {
			credential = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
		} catch {
			throw CeremonyError.invalidCredential();
		}
		if (typeof credential !== 'object' || credential === null || Array.isArray(credential)) {
			throw CeremonyError.invalidCredential();
		}
		return credential as PasskeyCredential;
	}

	static parseMobileLoginCallback(url: string, expectedState: string): string {
		const grouped = validatedCallbackItems(url, expectedState);
		const transactionId = grouped.get('transaction');
		if (
			!sameKeys(grouped, ['state', 'transaction']) ||
			transactionId === undefined ||
			transactionId === '' ||
			encodeUTF8(transactionId).length > 128
		) {
			throw CeremonyError.invalidCallback();
		}
		return transactionId;
	}

	static serverOrigin(baseURL: string): string | undefined {
		const parsed = parseURL(baseURL);
		if (!parsed || parsed.host === '') return undefined;
		const host = parsed.host.toLowerCase();
		const bareHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
		if (!(parsed.scheme === 'https' || (parsed.scheme === 'http' && isLoopbackHost(bareHost)))) {
			return undefined;
		}
		const port = parsed.port === undefined ? '' : `:${parsed.port}`;
		return `${parsed.scheme}://${parsed.host}${port}/`;
	}
}

function authenticatedResponse(result: AuthenticationResult): LoginResponse {
	if (result.kind === 'mfaRequired') throw new MFARequiredError(result.value);
	return result.value;
}

function isLoopbackHost(host: string): boolean {
	return (
		host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.startsWith('127.')
	);
}

function validatedCallbackItems(
	url: string,
	expectedState: string
): Map<string, string | undefined> {
	const components = urlComponents(url);
	if (
		!components ||
		components.scheme !== callbackScheme ||
		components.host !== callbackHost ||
		components.path !== '' ||
		components.user !== undefined ||
		components.password !== undefined ||
		components.port !== undefined ||
		components.fragment !== undefined ||
		components.queryItems === undefined
	) {
		throw CeremonyError.invalidCallback();
	}

	const grouped = new Map<string, string | undefined>();
	let duplicate = false;
	for (const item of components.queryItems) {
		if (grouped.has(item.name)) duplicate = true;
		grouped.set(item.name, item.value);
	}
	if (duplicate) throw CeremonyError.duplicateCallbackItem();
	if (grouped.get('state') !== expectedState) throw CeremonyError.stateMismatch();

	const errorCode = grouped.get('error');
	if (errorCode !== undefined) {
		if (!sameKeys(grouped, ['state', 'error']) || !bridgeErrorCodes.has(errorCode)) {
			throw CeremonyError.invalidCallback();
		}
		if (errorCode === 'cancelled') throw CeremonyError.cancelled();
		throw CeremonyError.bridgeFailure(errorCode);
	}
	return grouped;
}

function sameKeys(grouped: Map<string, unknown>, keys: string[]): boolean {
	return grouped.size === keys.length && keys.every((key) => grouped.has(key));
}
