/**
 * Port of `ArcaneClientManager.swift`: server configuration, the SDK client
 * lifecycle, every sign-in path (password, OIDC, passkey, MFA, demo), session
 * restore, and the access checks navigation relies on.
 *
 * Swift's per-call `Task` cancellation is replaced by authentication
 * generations: every async path captures `authenticationGeneration` and drops
 * its result once a newer sign-in, sign-out, or server change retires it.
 */
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import { create } from 'zustand';

import type { AppTab } from '@/core/app-tab';
import { canAccessTab, LoginCapabilities } from '@/core/auth/access';
import {
	ArcaneMobileOIDC,
	passkeyAuthenticatorOptions,
	presentAuthSession
} from '@/core/auth/auth-session';
import { AvatarDiskCache } from '@/core/auth/avatar-disk-cache';
import { demoBaseURL, DemoError, DemoService } from '@/core/auth/demo-service';
import {
	CredentialBinding,
	CredentialLease,
	CredentialPersistenceCoordinator,
	OriginTokenStore
} from '@/core/auth/token-store';
import { friendlyErrorMessage, isCancellation, shouldRefreshNetworkSession } from '@/core/errors';
import { ResponseCache } from '@/core/networking/response-cache';
import {
	boundedData,
	isHTTPStatusError,
	RemoteDataLimits
} from '@/core/networking/remote-data-limits';
import {
	canonicalServerOrigin,
	escapedPathComponent,
	hostOf,
	ipv4Octets,
	isIPAddress,
	isPublicIPAddress,
	isSameOrigin,
	normalizeServerURLInput,
	serverCacheIdentity
} from '@/core/networking/server-identity';
import { Keys, storage } from '@/core/storage';
import { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { EnvironmentID, RetryPolicy } from '@/sdk/client/environment';
import { ServerCapabilities } from '@/sdk/client/ServerCapabilities';
import { ArcaneError, CancellationError } from '@/sdk/errors/ArcaneError';
import {
	MFARequiredError,
	type AuthenticationResult,
	type MFAChallenge
} from '@/sdk/models/auth/Login';
import type { PermissionsManifest } from '@/sdk/models/role/PermissionsManifest';
import type { User } from '@/sdk/models/user/User';
import { VersionInfo } from '@/sdk/models/version/VersionInfo';
import { OIDCAuthenticator } from '@/sdk/oidc/OIDCAuthenticator';
import { ArcanePasskeyAuthenticator } from '@/sdk/passkeys/ArcanePasskeyAuthenticator';
import { CeremonyError } from '@/sdk/passkeys/CeremonyTypes';

export { LoginCapabilities } from '@/core/auth/access';
export { ArcaneMobileOIDC } from '@/core/auth/auth-session';

/** Port of `AppAuthState`. */
export type AppAuthState =
	| 'setup' // No server URL configured
	| 'authenticating' // Server URL set, checking existing tokens
	| 'login' // Server URL configured, not authenticated
	| 'authenticated'; // Logged in

export type DemoEndReason = 'userInitiated' | 'expired';

type ClientManagerState = {
	// MARK: Persisted config
	serverURL: string;
	parsedServerURL: string | undefined;

	// MARK: Auth state
	authState: AppAuthState;
	currentUser: User | undefined;
	serverCapabilities: ServerCapabilities | undefined;
	permissionsManifest: PermissionsManifest | undefined;
	isLoading: boolean;
	errorMessage: string | undefined;

	// MARK: Login capabilities
	loginCapabilities: LoginCapabilities | undefined;
	isOIDCSigningIn: boolean;

	// MARK: Passkeys and post-2.6 features
	isPasskeySigningIn: boolean;
	pendingMFAChallenge: MFAChallenge | undefined;
	supportsPost26MobileFeatures: boolean;
	supportsMobilePush: boolean;

	// MARK: Demo mode
	isDemoActive: boolean;
	isStartingDemo: boolean;
	/** Milliseconds since 1970. */
	demoEndsAt: number | undefined;
	demoExpiredMessage: string | undefined;

	allEnvironmentsPreview: boolean;
	/** Preview: live usage graphs, busiest containers and host metrics on the dashboard. */
	refreshedDashboardPreview: boolean;

	// MARK: Active environment
	activeEnvironmentID: EnvironmentID;
	activeEnvironmentName: string;

	// MARK: Client
	client: ArcaneClient | undefined;
	clientGeneration: number;
	authenticationGeneration: number;
	/** Rotates for every authenticated session; part of every cache key. */
	cacheSessionIdentity: string;
	/** Bumped when the user, capabilities, or permissions manifest change. */
	accessGeneration: number;

	/** Local file URI of the signed-in user's profile picture, if any. */
	currentUserAvatarURI: string | undefined;

	// MARK: Derived
	serverOrigin: () => string | undefined;
	isOIDCAvailable: () => boolean;
	isLocalAuthAvailable: () => boolean;
	supportsActivities: () => boolean;
	canAccess: (tab: AppTab) => boolean;
	acceptsEnvironmentContext: (id: EnvironmentID) => boolean;
	isCurrentAuthentication: (generation: number) => boolean;

	// MARK: Actions
	configure: (serverURL: string) => void;
	setErrorMessage: (message: string | undefined) => void;
	dismissDemoExpiredMessage: () => void;
	setActiveEnvironment: (id: EnvironmentID, name: string) => void;
	setAllEnvironmentsPreview: (enabled: boolean) => void;
	setRefreshedDashboardPreview: (enabled: boolean) => void;
	refreshOIDCStatus: () => Promise<void>;
	refreshLoginCapabilities: () => Promise<void>;
	retryConnectionBootstrapIfNeeded: () => Promise<void>;
	login: (username: string, password: string) => Promise<void>;
	loginWithOIDC: () => Promise<void>;
	loginWithPasskey: () => Promise<void>;
	completePendingMFAWithPasskey: () => Promise<void>;
	completePendingMFAWithRecoveryCode: (code: string) => Promise<void>;
	cancelPendingMFA: () => void;
	logout: () => Promise<void>;
	startDemo: () => Promise<void>;
	endDemo: (reason: DemoEndReason) => Promise<void>;
	checkExistingAuth: () => Promise<void>;
	refreshCurrentUserAvatar: (force?: boolean) => Promise<void>;
	fetchImageData: (url: string) => Promise<Uint8Array | undefined>;
};

const bootstrapTimeoutMs = 20_000;
const newSessionIdentity = () => randomUUID().toUpperCase();

/**
 * Exported for unit tests: which errors earn the "local DNS" hint. Swift
 * suggests it when the server's host name resolved only to public addresses
 * (iCloud Private Relay bypassing local DNS).
 */
export function shouldSuggestLocalDNSHint(
	error: unknown,
	serverURL: string | undefined,
	dnsAddresses: string[]
) {
	const host = serverURL ? hostOf(serverURL) : undefined;
	if (
		!shouldRefreshNetworkSession(error) ||
		!host ||
		isIPAddress(host) ||
		dnsAddresses.length === 0
	)
		return false;
	return dnsAddresses.every(isPublicIPAddress);
}

export const useClientManager = create<ClientManagerState>((set, get) => {
	// MARK: - Private state (Swift `private var`s that don't drive the UI)

	let credentialLease = new CredentialLease();
	const credentialPersistence = new CredentialPersistenceCoordinator();
	const bootstrapControllers = new Map<string, AbortController>();
	const bootstrapClients = new Map<string, ArcaneClient>();
	/** URL the current `client` was built for; lets `configureClient` skip needless rebuilds. */
	let configuredClientURL: string | undefined;
	let needsConnectionBootstrapRetry = false;
	let isRetryingConnectionBootstrap = false;
	/**
	 * Swift fills this from `getaddrinfo` to decide on the Private Relay hint.
	 * React Native has no resolver API, so it stays empty and the hint is
	 * never shown. TODO(dns): resolve via a native module if needed.
	 */
	let lastBootstrapDNSAddresses: string[] = [];
	let passkeyAuthenticator: ArcanePasskeyAuthenticator | undefined;
	let oidcAbort: AbortController | undefined;
	let demoExpiryTimer: ReturnType<typeof setTimeout> | undefined;
	/** De-dupes avatar fetches: session + user id + updatedAt. */
	let avatarFetchKey: string | undefined;

	const bumpAccess = () => set((s) => ({ accessGeneration: s.accessGeneration + 1 }));

	const isCurrentAuthentication = (generation: number) =>
		generation === get().authenticationGeneration;

	const requireCurrentAuthentication = (generation: number) => {
		if (!isCurrentAuthentication(generation)) throw new CancellationError();
	};

	// TODO(app-group): Swift mirrors server/env/session into the App Group for
	// widgets and intents. No widget extension in this build.
	const mirrorToAppGroup = () => {};

	const setCacheSessionIdentity = (identity = newSessionIdentity()) => {
		set({ cacheSessionIdentity: identity });
		mirrorToAppGroup();
	};

	// MARK: - Client construction

	const makeClient = (url: string, bootstrap: boolean, signal?: AbortSignal): ArcaneClient => {
		const origin = canonicalServerOrigin(url) ?? url;
		const demoHeaders = isSameOrigin(url, demoBaseURL) ? DemoService.cookieHeader : undefined;
		const client = new ArcaneClient({
			baseURL: url,
			tokenStore: new OriginTokenStore(origin, credentialLease, credentialPersistence),
			defaultEnvironmentID: EnvironmentID.localDocker,
			retryPolicy: bootstrap ? RetryPolicy.make(1, 300, 300) : RetryPolicy.make(3, 300, 3_000),
			timeoutMs: bootstrap ? bootstrapTimeoutMs : undefined,
			additionalHeaders: demoHeaders
		});
		return signal ? client.withSignal(signal) : client;
	};

	const clearPendingAuthentication = () => {
		passkeyAuthenticator?.cancel();
		passkeyAuthenticator = undefined;
		set({ pendingMFAChallenge: undefined, isPasskeySigningIn: false });
	};

	const configureClient = (url: string, force = false) => {
		// Reuse the live client when it already points at this URL: every
		// bootstrap round-trip would otherwise tear down in-flight streams.
		if (!force && get().client && configuredClientURL === url) return;
		clearPendingAuthentication();
		set((s) => ({ client: makeClient(url, false), clientGeneration: s.clientGeneration + 1 }));
		configuredClientURL = url;
	};

	const retireAuthentication = (allowCredentialClear = false) => {
		const current = get();
		set({ authenticationGeneration: current.authenticationGeneration + 1 });
		setCacheSessionIdentity();
		// TODO(push): PushNotificationCoordinator.sessionDidChange() — no push in this build.
		credentialLease.retire(allowCredentialClear);
		for (const client of [
			...bootstrapClients.values(),
			...(current.client ? [current.client] : [])
		]) {
			client.authManager.retirePendingAuthenticationOperations();
		}
		for (const controller of bootstrapControllers.values()) controller.abort();
		bootstrapControllers.clear();
		bootstrapClients.clear();
		oidcAbort?.abort();
		oidcAbort = undefined;
		clearPendingAuthentication();
		set({ isLoading: false, isStartingDemo: false, isOIDCSigningIn: false });
	};

	const beginAuthentication = (preservingMFAChallenge?: MFAChallenge): number => {
		retireAuthentication();
		credentialLease = new CredentialLease();
		const url = get().parsedServerURL;
		if (url) configureClient(url, true);
		set({ pendingMFAChallenge: preservingMFAChallenge });
		return get().authenticationGeneration;
	};

	const clearSessionState = () => {
		avatarFetchKey = undefined;
		clearPendingAuthentication();
		set({
			currentUser: undefined,
			currentUserAvatarURI: undefined,
			serverCapabilities: undefined,
			permissionsManifest: undefined,
			supportsPost26MobileFeatures: false,
			supportsMobilePush: false
		});
		bumpAccess();
	};

	const signOutLocally = () => {
		retireAuthentication();
		set({ authState: 'login' });
		setCacheSessionIdentity();
		clearSessionState();
		needsConnectionBootstrapRetry = false;
		const parsed = get().parsedServerURL;
		CredentialBinding.unbind(parsed ? canonicalServerOrigin(parsed) : undefined);
		// TODO(live-activities/widgets): DeploymentActivityStore.sessionDidEnd(),
		// WidgetSnapshotPublisher.publishSignedOut().
		ResponseCache.invalidateAll();
	};

	// MARK: - Bootstrap requests

	const runBootstrapOperation = async <T>(
		url: string,
		operation: (client: ArcaneClient) => Promise<T>
	): Promise<T> => {
		const id = randomUUID();
		const controller = new AbortController();
		const client = makeClient(url, true, controller.signal);
		bootstrapControllers.set(id, controller);
		bootstrapClients.set(id, client);
		try {
			return await operation(client);
		} finally {
			bootstrapControllers.delete(id);
			bootstrapClients.delete(id);
		}
	};

	/**
	 * Runs `operation` on a short-timeout bootstrap client. A transient network
	 * failure (possibly a wedged connection) rebuilds the client and retries once.
	 */
	const withNetworkSessionRefreshRetry = async <T>(
		operation: (client: ArcaneClient) => Promise<T>
	): Promise<T> => {
		const url = get().parsedServerURL;
		if (!url) throw ArcaneError.transport('No client');
		const generation = get().authenticationGeneration;
		try {
			const result = await runBootstrapOperation(url, operation);
			requireCurrentAuthentication(generation);
			configureClient(url);
			return result;
		} catch (error) {
			requireCurrentAuthentication(generation);
			if (!shouldRefreshNetworkSession(error)) throw error;
			// The transient failure may be a wedged session — force a rebuild.
			configureClient(url, true);
			await new Promise((resolve) => setTimeout(resolve, 500));
			requireCurrentAuthentication(generation);
			const result = await runBootstrapOperation(url, operation);
			requireCurrentAuthentication(generation);
			configureClient(url);
			return result;
		}
	};

	// MARK: - Error wording

	const connectionAwareErrorMessage = (error: unknown, passwordLogin = false): string => {
		if (passwordLogin && error instanceof ArcaneError && error.kind === 'unauthorized') {
			return 'Invalid username or password';
		}
		const base = friendlyErrorMessage(error);
		if (!shouldSuggestLocalDNSHint(error, get().parsedServerURL, lastBootstrapDNSAddresses))
			return base;
		return Platform.OS === 'ios'
			? `${base} If this is your local Arcane server, iCloud Private Relay or Limit IP Address Tracking may be bypassing local DNS. Turn it off for this Wi-Fi network, then try again.`
			: `${base} If this is your local Arcane server, Private DNS or a VPN may be bypassing local DNS. Turn it off for this Wi-Fi network, then try again.`;
	};

	const loginErrorMessage = (error: unknown) => connectionAwareErrorMessage(error, true);

	// MARK: - Login capabilities

	const fetchLoginCapabilitiesIfAvailable = async (client: ArcaneClient) => {
		try {
			const settings = await client.settings.getPublicSettings({
				envID: EnvironmentID.localDocker
			});
			return LoginCapabilities.fromPublicSettings(settings);
		} catch {
			return undefined;
		}
	};

	const refreshLoginCapabilities = async () => {
		const client = get().client;
		if (!client) {
			set({ loginCapabilities: undefined });
			return;
		}
		const generation = get().authenticationGeneration;
		const next = await fetchLoginCapabilitiesIfAvailable(client);
		if (!isCurrentAuthentication(generation)) return;
		set({ loginCapabilities: next });
	};

	// MARK: - Authenticated bootstrap

	/**
	 * Finishes every successful authentication path. The manifest is session
	 * metadata, so a fetch failure must not block sign-in; navigation falls back
	 * to the legacy admin policy.
	 */
	const completeAuthenticatedBootstrap = async (
		user: User,
		capabilities: ServerCapabilities,
		client: ArcaneClient,
		generation: number
	) => {
		if (!isCurrentAuthentication(generation)) return;
		setCacheSessionIdentity();
		set({ currentUser: user, serverCapabilities: capabilities });
		bumpAccess();
		// Permissions and version load together rather than one after the other.
		const loadsPermissions = capabilities.mode === 'rbac';
		const [manifest, versionInfo] = await Promise.all([
			loadsPermissions
				? client.roles.availablePermissions().catch(() => undefined)
				: Promise.resolve(undefined),
			client.version.appVersion().catch(() => undefined)
		]);
		if (!isCurrentAuthentication(generation)) return;
		set({
			permissionsManifest: loadsPermissions ? manifest : undefined,
			supportsPost26MobileFeatures: versionInfo
				? VersionInfo.supportsPost26MobileFeatures(versionInfo)
				: false,
			supportsMobilePush: versionInfo ? VersionInfo.supportsMobilePush(versionInfo) : false,
			pendingMFAChallenge: undefined,
			authState: 'authenticated'
		});
		bumpAccess();
		// TODO(push): PushNotificationCoordinator.registerIfAuthorized() when supportsMobilePush.
	};

	const applyAuthenticationResult = async (
		result: AuthenticationResult,
		client: ArcaneClient,
		generation: number
	) => {
		if (!isCurrentAuthentication(generation)) return;
		switch (result.kind) {
			case 'authenticated':
				set({ pendingMFAChallenge: undefined });
				await completeAuthenticatedBootstrap(
					result.value.user,
					ServerCapabilities.make(ServerCapabilities.detect(result.value.user)),
					client,
					generation
				);
				break;
			case 'mfaRequired':
				set({ pendingMFAChallenge: result.value, authState: 'login' });
				break;
		}
	};

	/**
	 * Preserve stored credentials after transient bootstrap failures without
	 * showing the signed-in UI until `auth/me` loads a real user.
	 */
	const keepSignedInIfCredentialPresent = async (
		client: ArcaneClient,
		error: unknown,
		generation: number
	) => {
		const hasCredential = await client.authManager.hasRefreshCredential().catch(() => false);
		if (!isCurrentAuthentication(generation)) return;
		if (!hasCredential) {
			signOutLocally();
			await refreshLoginCapabilities();
			return;
		}
		clearSessionState();
		setCacheSessionIdentity();
		set({ authState: 'login', errorMessage: connectionAwareErrorMessage(error) });
		needsConnectionBootstrapRetry = shouldRefreshNetworkSession(error);
		ResponseCache.invalidateAll();
	};

	/** Swift catches `ASWebAuthenticationSessionError.canceledLogin` and `CeremonyError.cancelled` silently. */
	const isUserCancellation = (error: unknown) =>
		isCancellation(error) || (error instanceof CeremonyError && error.kind === 'cancelled');

	// MARK: - Demo

	const scheduleDemoExpiry = (endsAt: number) => {
		if (demoExpiryTimer !== undefined) clearTimeout(demoExpiryTimer);
		const interval = endsAt - Date.now();
		if (interval <= 0) {
			void get().endDemo('expired');
			return;
		}
		demoExpiryTimer = setTimeout(() => {
			demoExpiryTimer = undefined;
			void get().endDemo('expired');
		}, interval);
	};

	// MARK: - Avatar

	const fetchGravatar = async (user: User, client: ArcaneClient, generation: number) => {
		const email = user.email?.trim().toLowerCase();
		if (!email) return undefined;
		// Only reach out to Gravatar when the server has it enabled, like the
		// web UI — don't leak email hashes to a third party otherwise.
		try {
			const settings = await client.settings.getSettings({ envID: EnvironmentID.localDocker });
			if (!isCurrentAuthentication(generation)) return undefined;
			if (settings.find((s) => s.key === 'enableGravatar')?.value.toLowerCase() !== 'true')
				return undefined;
		} catch {
			return undefined;
		}
		const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, email);
		// d=404 keeps Gravatar's generated placeholders out — no image means
		// we show our own initials fallback.
		return get().fetchImageData(`https://www.gravatar.com/avatar/${hash}?s=160&d=404`);
	};

	// MARK: - Init

	const savedURL = storage.string(Keys.serverURL) ?? '';
	const initialParsed = savedURL ? normalizeServerURLInput(savedURL) && savedURL : undefined;
	let initialClient: ArcaneClient | undefined;
	if (initialParsed) {
		const origin = canonicalServerOrigin(initialParsed);
		// Swift binds legacy credentials to the configured origin on upgrade.
		if (origin && CredentialBinding.origin === undefined) CredentialBinding.bind(origin);
		initialClient = makeClient(initialParsed, false);
		configuredClientURL = initialParsed;
	}
	const savedEnvID = storage.string(Keys.activeEnvironmentID);
	if (savedEnvID === undefined) {
		// Persist the default env (id 0) so it's always explicit.
		storage.set(Keys.activeEnvironmentID, EnvironmentID.localDocker);
		storage.set(Keys.activeEnvironmentName, 'Local Docker');
	}

	return {
		serverURL: savedURL,
		parsedServerURL: initialParsed,
		authState: initialParsed ? 'authenticating' : 'setup',
		currentUser: undefined,
		serverCapabilities: undefined,
		permissionsManifest: undefined,
		isLoading: false,
		errorMessage: undefined,
		loginCapabilities: undefined,
		isOIDCSigningIn: false,
		isPasskeySigningIn: false,
		pendingMFAChallenge: undefined,
		supportsPost26MobileFeatures: false,
		supportsMobilePush: false,
		isDemoActive: false,
		isStartingDemo: false,
		demoEndsAt: undefined,
		demoExpiredMessage: undefined,
		allEnvironmentsPreview: storage.bool(Keys.allEnvironmentsPreview) ?? false,
		refreshedDashboardPreview: storage.bool(Keys.refreshedDashboardPreview) ?? false,
		activeEnvironmentID: savedEnvID ?? EnvironmentID.localDocker,
		activeEnvironmentName:
			savedEnvID !== undefined
				? (storage.string(Keys.activeEnvironmentName) ?? 'Local Docker')
				: 'Local Docker',
		client: initialClient,
		clientGeneration: initialClient ? 1 : 0,
		authenticationGeneration: 0,
		cacheSessionIdentity: newSessionIdentity(),
		accessGeneration: 0,
		currentUserAvatarURI: undefined,

		// MARK: - Derived

		serverOrigin: () => {
			const parsed = get().parsedServerURL;
			return parsed ? canonicalServerOrigin(parsed) : undefined;
		},
		isOIDCAvailable: () => get().loginCapabilities?.oidcEnabled === true,
		isLocalAuthAvailable: () => get().loginCapabilities?.localAuthEnabled ?? true,
		supportsActivities: () => get().serverCapabilities?.mode === 'rbac',
		canAccess: (tab) => canAccessTab(tab, get()),
		acceptsEnvironmentContext: (id) =>
			get().allEnvironmentsPreview || get().activeEnvironmentID === id,
		isCurrentAuthentication,

		// MARK: - Server setup

		configure: (url) => {
			// Clear a stale validation error before re-validating.
			set({ errorMessage: undefined });
			const normalized = normalizeServerURLInput(url);
			if (!normalized) {
				set({ errorMessage: 'Invalid server URL' });
				return;
			}
			const previous = get().parsedServerURL;
			const previousOrigin = previous ? canonicalServerOrigin(previous) : undefined;
			const nextOrigin = canonicalServerOrigin(normalized);
			if (previousOrigin !== undefined && previousOrigin !== nextOrigin) {
				// TODO(push): PushNotificationCoordinator.tearDown(client:origin:).
				CredentialBinding.unbind(previousOrigin);
				signOutLocally();
			}
			retireAuthentication();
			credentialLease = new CredentialLease();
			needsConnectionBootstrapRetry = false;
			isRetryingConnectionBootstrap = false;
			storage.set(Keys.serverURL, normalized);
			set({ serverURL: normalized, parsedServerURL: normalized });
			clearSessionState();
			lastBootstrapDNSAddresses = [];
			// Explicit (re)configuration — always rebuild, even for the same URL.
			setCacheSessionIdentity();
			configureClient(normalized, true);
			set({ authState: 'login', loginCapabilities: undefined });
			mirrorToAppGroup();
			ResponseCache.invalidateAll();
			void refreshLoginCapabilities();
		},

		setErrorMessage: (message) => set({ errorMessage: message }),
		dismissDemoExpiredMessage: () => set({ demoExpiredMessage: undefined }),

		setActiveEnvironment: (id, name) => {
			if (get().allEnvironmentsPreview) return;
			const previous = get().activeEnvironmentID;
			set({ activeEnvironmentID: id, activeEnvironmentName: name });
			storage.set(Keys.activeEnvironmentID, id);
			storage.set(Keys.activeEnvironmentName, name);
			mirrorToAppGroup();
			bumpAccess();
			if (previous !== id) ResponseCache.invalidateEnvironment(previous);
		},

		setAllEnvironmentsPreview: (enabled) => {
			storage.set(Keys.allEnvironmentsPreview, enabled);
			set({ allEnvironmentsPreview: enabled });
			bumpAccess();
		},

		setRefreshedDashboardPreview: (enabled) => {
			storage.set(Keys.refreshedDashboardPreview, enabled);
			set({ refreshedDashboardPreview: enabled });
		},

		refreshOIDCStatus: refreshLoginCapabilities,
		refreshLoginCapabilities,

		retryConnectionBootstrapIfNeeded: async () => {
			if (!needsConnectionBootstrapRetry || isRetryingConnectionBootstrap) return;
			const client = get().client;
			if (!client) {
				needsConnectionBootstrapRetry = false;
				return;
			}
			const generation = get().authenticationGeneration;
			isRetryingConnectionBootstrap = true;
			try {
				const hasCredential = await client.authManager.hasRefreshCredential().catch(() => false);
				if (!isCurrentAuthentication(generation)) return;
				if (hasCredential) await get().checkExistingAuth();
				else await refreshLoginCapabilities();
			} finally {
				if (isCurrentAuthentication(generation)) isRetryingConnectionBootstrap = false;
			}
		},

		// MARK: - Auth

		login: async (username, password) => {
			if (!get().client) {
				set({ errorMessage: 'No server configured' });
				return;
			}
			const generation = beginAuthentication();
			const client = get().client;
			if (!client) return;
			set({ isLoading: true, errorMessage: undefined });
			try {
				const result = await withNetworkSessionRefreshRetry((bootstrap) =>
					bootstrap.auth.authenticate({ username, password })
				);
				if (!isCurrentAuthentication(generation)) return;
				await applyAuthenticationResult(result, get().client ?? client, generation);
				if (!isCurrentAuthentication(generation)) return;
				needsConnectionBootstrapRetry = false;
			} catch (error) {
				if (!isCurrentAuthentication(generation)) return;
				needsConnectionBootstrapRetry = shouldRefreshNetworkSession(error);
				set({ errorMessage: connectionAwareErrorMessage(error, true) });
			} finally {
				if (isCurrentAuthentication(generation)) set({ isLoading: false });
			}
		},

		loginWithOIDC: async () => {
			if (!get().client) {
				set({ errorMessage: 'No server configured' });
				return;
			}
			const generation = beginAuthentication();
			const client = get().client;
			if (!client) return;
			const abort = new AbortController();
			oidcAbort = abort;
			set({ errorMessage: undefined, isOIDCSigningIn: true });
			try {
				const authenticator = new OIDCAuthenticator(client, { presentAuthSession });
				const result = await authenticator.signIn({
					callbackURLScheme: ArcaneMobileOIDC.callbackURLScheme,
					redirectURI: ArcaneMobileOIDC.redirectURI,
					signal: abort.signal
				});
				if (!isCurrentAuthentication(generation)) return;
				const capabilities = client.serverCapabilities();
				await completeAuthenticatedBootstrap(result.user, capabilities, client, generation);
				if (!isCurrentAuthentication(generation)) return;
				needsConnectionBootstrapRetry = false;
			} catch (error) {
				if (error instanceof MFARequiredError) {
					if (!isCurrentAuthentication(generation)) return;
					set({ pendingMFAChallenge: error.challenge, authState: 'login' });
					return;
				}
				// The user closed the browser — no error message needed.
				if (isUserCancellation(error)) return;
				if (!isCurrentAuthentication(generation)) return;
				set({ errorMessage: loginErrorMessage(error) });
			} finally {
				if (oidcAbort === abort) oidcAbort = undefined;
				if (isCurrentAuthentication(generation)) set({ isOIDCSigningIn: false });
			}
		},

		loginWithPasskey: async () => {
			if (!get().client) {
				set({ errorMessage: 'No server configured' });
				return;
			}
			const generation = beginAuthentication();
			const client = get().client;
			if (!client) return;
			const authenticator = new ArcanePasskeyAuthenticator(client, passkeyAuthenticatorOptions);
			passkeyAuthenticator = authenticator;
			set({ isPasskeySigningIn: true, errorMessage: undefined });
			try {
				const result = await authenticator.authenticateLogin();
				if (!isCurrentAuthentication(generation)) return;
				await applyAuthenticationResult(result, client, generation);
			} catch (error) {
				if (isUserCancellation(error)) return;
				if (!isCurrentAuthentication(generation)) return;
				set({ errorMessage: friendlyErrorMessage(error) });
			} finally {
				if (passkeyAuthenticator === authenticator) {
					passkeyAuthenticator = undefined;
					set({ isPasskeySigningIn: false });
				}
			}
		},

		completePendingMFAWithPasskey: async () => {
			const challenge = get().pendingMFAChallenge;
			if (!get().client || !challenge) return;
			const generation = beginAuthentication(challenge);
			const client = get().client;
			if (!client) return;
			const authenticator = new ArcanePasskeyAuthenticator(client, passkeyAuthenticatorOptions);
			passkeyAuthenticator = authenticator;
			set({ isPasskeySigningIn: true, errorMessage: undefined });
			try {
				const response = await authenticator.completeMFA({
					transactionId: challenge.transactionId
				});
				if (!isCurrentAuthentication(generation)) return;
				set({ pendingMFAChallenge: undefined });
				await completeAuthenticatedBootstrap(
					response.user,
					ServerCapabilities.make(ServerCapabilities.detect(response.user)),
					client,
					generation
				);
			} catch (error) {
				if (isUserCancellation(error)) return;
				if (!isCurrentAuthentication(generation)) return;
				set({ errorMessage: friendlyErrorMessage(error) });
			} finally {
				if (passkeyAuthenticator === authenticator) {
					passkeyAuthenticator = undefined;
					set({ isPasskeySigningIn: false });
				}
			}
		},

		completePendingMFAWithRecoveryCode: async (code) => {
			const challenge = get().pendingMFAChallenge;
			if (!get().client || !challenge) return;
			const generation = beginAuthentication(challenge);
			const client = get().client;
			if (!client) return;
			set({ isLoading: true, errorMessage: undefined });
			try {
				const result = await client.passkeys.finishRecovery({
					transactionId: challenge.transactionId,
					code: code.trim()
				});
				if (!isCurrentAuthentication(generation)) return;
				await applyAuthenticationResult(result, client, generation);
			} catch (error) {
				if (!isCurrentAuthentication(generation)) return;
				set({ errorMessage: friendlyErrorMessage(error) });
			} finally {
				if (isCurrentAuthentication(generation)) set({ isLoading: false });
			}
		},

		cancelPendingMFA: () => {
			retireAuthentication();
			passkeyAuthenticator?.cancel();
			passkeyAuthenticator = undefined;
			set({
				pendingMFAChallenge: undefined,
				errorMessage: undefined,
				isPasskeySigningIn: false,
				authState: 'login'
			});
		},

		logout: async () => {
			if (get().isDemoActive) {
				await get().endDemo('userInitiated');
				return;
			}
			const client = get().client;
			if (!client) {
				signOutLocally();
				return;
			}
			retireAuthentication(true);
			AvatarDiskCache.clear();
			const generation = get().authenticationGeneration;
			set({ isLoading: true });
			try {
				// TODO(push): PushNotificationCoordinator.tearDown(client:origin:).
				let logoutError: unknown;
				try {
					await client.auth.logout();
				} catch (error) {
					logoutError = error;
				}
				if (!isCurrentAuthentication(generation)) return;
				let credentialRemains: boolean;
				try {
					credentialRemains = await client.authManager.hasRefreshCredential();
				} catch (error) {
					set({
						errorMessage: `Couldn't verify that local sign-in credentials were removed. ${friendlyErrorMessage(error)}`
					});
					return;
				}
				if (!isCurrentAuthentication(generation)) return;
				if (credentialRemains) {
					set({
						errorMessage:
							logoutError !== undefined
								? friendlyErrorMessage(logoutError)
								: "Couldn't remove local sign-in credentials."
					});
					return;
				}
				signOutLocally();
				set({ errorMessage: undefined });
				ResponseCache.invalidateAll();
			} finally {
				if (isCurrentAuthentication(generation)) set({ isLoading: false });
			}
		},

		// MARK: - Demo

		startDemo: async () => {
			let generation = beginAuthentication();
			set({
				isLoading: true,
				isStartingDemo: true,
				errorMessage: undefined,
				demoExpiredMessage: undefined
			});
			try {
				const session = await DemoService.startInstance();
				if (!isCurrentAuthentication(generation)) return;
				get().configure(demoBaseURL);
				generation = get().authenticationGeneration;
				set({ isLoading: true, isStartingDemo: true });
				const client = get().client;
				if (!client) {
					set({ errorMessage: 'Failed to configure demo client' });
					return;
				}
				try {
					const response = await client.auth.login({
						username: session.username,
						password: session.password
					});
					if (!isCurrentAuthentication(generation)) return;
					const capabilities = client.serverCapabilities();
					await completeAuthenticatedBootstrap(response.user, capabilities, client, generation);
					if (!isCurrentAuthentication(generation)) return;
					needsConnectionBootstrapRetry = false;
					set({ isDemoActive: true, demoEndsAt: session.endsAt });
					DemoService.startHeartbeat();
					scheduleDemoExpiry(session.endsAt);
				} catch (error) {
					if (!isCurrentAuthentication(generation)) return;
					set({ errorMessage: loginErrorMessage(error) });
					await DemoService.endSession();
				}
			} catch (error) {
				if (!isCurrentAuthentication(generation)) return;
				set({
					errorMessage: error instanceof DemoError ? error.message : friendlyErrorMessage(error)
				});
			} finally {
				if (isCurrentAuthentication(generation)) set({ isLoading: false, isStartingDemo: false });
			}
		},

		endDemo: async (reason) => {
			retireAuthentication(true);
			if (demoExpiryTimer !== undefined) clearTimeout(demoExpiryTimer);
			demoExpiryTimer = undefined;

			// Update UI state synchronously first so the user is sent back to the
			// login screen immediately — don't wait on network cleanup.
			const endingClient = get().client;
			const parsed = get().parsedServerURL;
			const endingOrigin = parsed ? canonicalServerOrigin(parsed) : undefined;
			// TODO(push): PushNotificationCoordinator.tearDown(client:origin:).
			setCacheSessionIdentity();
			clearSessionState();
			needsConnectionBootstrapRetry = false;
			isRetryingConnectionBootstrap = false;
			storage.set(Keys.serverURL, '');
			configuredClientURL = undefined;
			set((s) => ({
				isDemoActive: false,
				demoEndsAt: undefined,
				serverURL: '',
				parsedServerURL: undefined,
				client: undefined,
				clientGeneration: s.clientGeneration + 1,
				authState: 'setup',
				demoExpiredMessage:
					reason === 'expired'
						? 'Your demo ended. Start a new one or connect to your own server.'
						: s.demoExpiredMessage
			}));
			CredentialBinding.unbind(endingOrigin);

			await DemoService.endSession();
			await endingClient?.auth.logout().catch(() => undefined);
			ResponseCache.invalidateAll();
		},

		// MARK: - Session restore

		checkExistingAuth: async () => {
			const generation = get().authenticationGeneration;
			const client = get().client;
			if (!client) {
				if (get().authState === 'authenticating') set({ authState: 'login' });
				return;
			}

			// A secure-store read hiccup is treated as "unknown" — never as
			// signed-out. `me()` below confirms the real state.
			let hasCredential: boolean;
			try {
				hasCredential = await client.authManager.hasRefreshCredential();
			} catch {
				hasCredential = true;
			}
			if (!isCurrentAuthentication(generation)) return;
			if (!hasCredential) {
				// No stored credential at all — the user is genuinely signed out.
				signOutLocally();
				await refreshLoginCapabilities();
				return;
			}

			try {
				const user = await withNetworkSessionRefreshRetry((bootstrap) => bootstrap.auth.me());
				await completeAuthenticatedBootstrap(
					user,
					ServerCapabilities.make(ServerCapabilities.detect(user)),
					get().client ?? client,
					generation
				);
				if (!isCurrentAuthentication(generation)) return;
				needsConnectionBootstrapRetry = false;
			} catch (error) {
				if (!isCurrentAuthentication(generation)) return;
				if (
					error instanceof ArcaneError &&
					(error.kind === 'unauthorized' || error.kind === 'forbidden')
				) {
					// The server explicitly rejected the stored credential. This is the
					// ONLY path that signs the user out without an explicit logout.
					signOutLocally();
					await refreshLoginCapabilities();
					return;
				}
				// Transient failures (network, decoding, cancellation…) keep credentials
				// but fall back to login until a real user payload loads.
				await keepSignedInIfCredentialPresent(client, error, generation);
			}
		},

		// MARK: - Current user avatar

		/**
		 * Syncs the profile picture. Safe to call from every view that renders
		 * the avatar — it only hits the network when the user (or their
		 * `updatedAt`) changed. A custom uploaded avatar wins; otherwise Gravatar
		 * by email when the server's `enableGravatar` setting is on.
		 */
		refreshCurrentUserAvatar: async (force = false) => {
			const { client, currentUser: user } = get();
			if (!client || !user) {
				set({ currentUserAvatarURI: undefined });
				avatarFetchKey = undefined;
				return;
			}
			const generation = get().authenticationGeneration;
			const key = `${get().cacheSessionIdentity}|${user.id}|${user.updatedAt ?? ''}`;
			if (!force && key === avatarFetchKey) return;
			avatarFetchKey = key;
			const isCurrent = () => isCurrentAuthentication(generation) && avatarFetchKey === key;
			// Session-independent, so the picture survives relaunches.
			const parsed = get().parsedServerURL;
			const server = parsed ? serverCacheIdentity(parsed) : get().serverURL;
			const diskKey = `${server}|${user.id}|${user.updatedAt ?? ''}`;
			if (!force) {
				const cached = await AvatarDiskCache.load(diskKey);
				if (cached) {
					if (!isCurrent()) return;
					set({ currentUserAvatarURI: cached });
					return;
				}
			}
			try {
				const data = await boundedData(client, `users/${escapedPathComponent(user.id)}/avatar`, {
					maximumBytes: RemoteDataLimits.maximumImageBytes,
					accept: 'image/*'
				});
				if (!isCurrent()) return;
				const uri = await AvatarDiskCache.save(data, diskKey);
				if (!isCurrent()) return;
				set({ currentUserAvatarURI: uri });
				return;
			} catch (error) {
				// 404: no uploaded avatar; continue to the optional Gravatar fallback.
				if (!isHTTPStatusError(error, 404)) {
					if (!isCurrent()) return;
					set({ currentUserAvatarURI: undefined });
					avatarFetchKey = undefined;
					return;
				}
			}
			const fallback = await fetchGravatar(user, client, generation);
			if (!isCurrent()) return;
			const uri = fallback ? await AvatarDiskCache.save(fallback, diskKey) : undefined;
			if (!isCurrent()) return;
			set({ currentUserAvatarURI: uri });
		},

		// MARK: - Image fetching

		fetchImageData: async (urlString) => {
			const { client, parsedServerURL } = get();
			if (!client || !isAllowedImageURL(urlString, parsedServerURL)) return undefined;
			const sameOrigin = parsedServerURL !== undefined && isSameOrigin(urlString, parsedServerURL);
			const headers: Record<string, string> = sameOrigin
				? await client.authManager.authenticationHeaders().catch(() => ({}))
				: {};
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 30_000);
			try {
				const response = await fetch(urlString, { headers, signal: controller.signal });
				// Redirects are followed by the platform (which drops Authorization
				// across origins); vet where we ended up.
				if (response.url && !isAllowedImageURL(response.url, parsedServerURL)) return undefined;
				if (response.status !== 200) return undefined;
				const declared = Number(response.headers.get('content-length') ?? -1);
				if (declared > RemoteDataLimits.maximumImageBytes) return undefined;
				const contentType = response.headers.get('content-type')?.toLowerCase();
				if (
					contentType &&
					!contentType.startsWith('image/') &&
					!contentType.startsWith('application/octet-stream')
				) {
					return undefined;
				}
				const data = new Uint8Array(await response.arrayBuffer());
				return data.byteLength > RemoteDataLimits.maximumImageBytes ? undefined : data;
			} catch {
				return undefined;
			} finally {
				clearTimeout(timer);
			}
		}
	};
});

/**
 * Port of `isAllowedImageURL`. Same-origin images may use http(s); anything
 * else must be https on 443. Swift additionally resolves the host and requires
 * public addresses; React Native has no resolver, so only IP literals are
 * vetted (TODO(dns)).
 */
function isAllowedImageURL(url: string, serverURL: string | undefined): boolean {
	const match = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]*)/.exec(url);
	if (!match) return false;
	const [, rawScheme = '', authority = ''] = match;
	if (authority.includes('@')) return false;
	const scheme = rawScheme.toLowerCase();
	const host = hostOf(url);
	if (!host) return false;
	if (serverURL && isSameOrigin(url, serverURL)) return scheme === 'http' || scheme === 'https';
	const portMatch = /:(\d+)$/.exec(authority.replace(/^\[[^\]]*\]/, ''));
	if (scheme !== 'https' || (portMatch && portMatch[1] !== '443')) return false;
	if (ipv4Octets(host) || host.includes(':')) return isPublicIPAddress(host);
	return true;
}
