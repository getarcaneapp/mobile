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
import type { APIGeneration } from '@/sdk/client/apiGeneration';
import { EnvironmentID, RetryPolicy } from '@/sdk/client/environment';
import { ServerCapabilities } from '@/sdk/client/ServerCapabilities';
import { ArcaneError, CancellationError } from '@/sdk/errors/ArcaneError';
import {
	MFARequiredError,
	type AuthenticationResult,
	type MFAChallenge
} from '@/sdk/models/auth/Login';
import type { SessionBootstrap } from '@/sdk/models/auth/SessionBootstrap';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { PermissionsManifest } from '@/sdk/models/role/PermissionsManifest';
import type { User } from '@/sdk/models/user/User';
import { VersionInfo } from '@/sdk/models/version/VersionInfo';
import { OIDCAuthenticator } from '@/sdk/oidc/OIDCAuthenticator';
import { ArcanePasskeyAuthenticator } from '@/sdk/passkeys/ArcanePasskeyAuthenticator';
import { CeremonyError } from '@/sdk/passkeys/CeremonyTypes';

export { LoginCapabilities } from '@/core/auth/access';
export { ArcaneMobileOIDC } from '@/core/auth/auth-session';

export type AppAuthState = 'setup' | 'authenticating' | 'login' | 'authenticated';

export type DemoEndReason = 'userInitiated' | 'expired';

type ClientManagerState = {
	serverURL: string;
	parsedServerURL: string | undefined;

	authState: AppAuthState;
	currentUser: User | undefined;
	serverCapabilities: ServerCapabilities | undefined;
	permissionsManifest: PermissionsManifest | undefined;
	isLoading: boolean;
	errorMessage: string | undefined;

	loginCapabilities: LoginCapabilities | undefined;
	isOIDCSigningIn: boolean;

	isPasskeySigningIn: boolean;
	pendingMFAChallenge: MFAChallenge | undefined;
	supportsPost26MobileFeatures: boolean;
	supportsMobilePush: boolean;
	apiGeneration: APIGeneration | undefined;
	takeBootstrapEnvironments: (sessionIdentity: string) => Environment[] | undefined;

	isDemoActive: boolean;
	isStartingDemo: boolean;
	demoEndsAt: number | undefined;
	demoExpiredMessage: string | undefined;

	allEnvironmentsPreview: boolean;
	refreshedDashboardPreview: boolean;

	activeEnvironmentID: EnvironmentID;
	activeEnvironmentName: string;

	client: ArcaneClient | undefined;
	clientGeneration: number;
	authenticationGeneration: number;
	cacheSessionIdentity: string;
	accessGeneration: number;

	currentUserAvatarURI: string | undefined;

	serverOrigin: () => string | undefined;
	isOIDCAvailable: () => boolean;
	isLocalAuthAvailable: () => boolean;
	supportsActivities: () => boolean;
	canAccess: (tab: AppTab) => boolean;
	acceptsEnvironmentContext: (id: EnvironmentID) => boolean;
	isCurrentAuthentication: (generation: number) => boolean;

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

async function sessionBootstrapIfAvailable(
	client: ArcaneClient
): Promise<SessionBootstrap | undefined> {
	if ((await client.apiGeneration()) !== 'v3') return undefined;
	return client.auth.sessionBootstrap().catch(() => undefined);
}

function rememberedAPIGeneration(serverURL: string | undefined): APIGeneration | undefined {
	const origin = serverURL ? canonicalServerOrigin(serverURL) : undefined;
	const stored = storage.string(Keys.serverAPIGeneration);
	if (!origin || !stored) return undefined;
	const separator = stored.indexOf('@');
	if (separator < 0 || stored.slice(separator + 1) !== origin) return undefined;
	const generation = stored.slice(0, separator);
	return generation === 'v3' || generation === 'legacy' ? generation : undefined;
}

function rememberAPIGeneration(
	serverURL: string | undefined,
	generation: APIGeneration | undefined
): void {
	const origin = serverURL ? canonicalServerOrigin(serverURL) : undefined;
	if (!origin || !generation) return;
	storage.set(Keys.serverAPIGeneration, `${generation}@${origin}`);
}

function previewModes(generation: APIGeneration | undefined) {
	if (generation === 'v3') return { allEnvironmentsPreview: true, refreshedDashboardPreview: true };
	return {
		allEnvironmentsPreview: storage.bool(Keys.allEnvironmentsPreview) ?? false,
		refreshedDashboardPreview: storage.bool(Keys.refreshedDashboardPreview) ?? false
	};
}

export const useClientManager = create<ClientManagerState>((set, get) => {
	let credentialLease = new CredentialLease();
	const credentialPersistence = new CredentialPersistenceCoordinator();
	const bootstrapControllers = new Map<string, AbortController>();
	const bootstrapClients = new Map<string, ArcaneClient>();
	let configuredClientURL: string | undefined;
	let bootstrapEnvironments: { session: string; environments: Environment[] } | undefined;
	let needsConnectionBootstrapRetry = false;
	let isRetryingConnectionBootstrap = false;
	let lastBootstrapDNSAddresses: string[] = [];
	let passkeyAuthenticator: ArcanePasskeyAuthenticator | undefined;
	let oidcAbort: AbortController | undefined;
	let demoExpiryTimer: ReturnType<typeof setTimeout> | undefined;
	let avatarFetchKey: string | undefined;

	const bumpAccess = () => set((s) => ({ accessGeneration: s.accessGeneration + 1 }));

	const isCurrentAuthentication = (generation: number) =>
		generation === get().authenticationGeneration;

	const requireCurrentAuthentication = (generation: number) => {
		if (!isCurrentAuthentication(generation)) throw new CancellationError();
	};

	const mirrorToAppGroup = () => {};

	const setCacheSessionIdentity = (identity = newSessionIdentity()) => {
		set({ cacheSessionIdentity: identity });
		mirrorToAppGroup();
	};

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
		if (!force && get().client && configuredClientURL === url) return;
		clearPendingAuthentication();
		set((s) => ({ client: makeClient(url, false), clientGeneration: s.clientGeneration + 1 }));
		configuredClientURL = url;
	};

	const retireAuthentication = (allowCredentialClear = false) => {
		const current = get();
		set({ authenticationGeneration: current.authenticationGeneration + 1 });
		setCacheSessionIdentity();
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
		bootstrapEnvironments = undefined;
		clearPendingAuthentication();
		set({
			currentUser: undefined,
			currentUserAvatarURI: undefined,
			serverCapabilities: undefined,
			permissionsManifest: undefined,
			supportsPost26MobileFeatures: false,
			supportsMobilePush: false,
			apiGeneration: undefined,
			...previewModes(rememberedAPIGeneration(get().parsedServerURL))
		});
		bumpAccess();
	};

	const usesV3Defaults = () =>
		get().apiGeneration === 'v3' || rememberedAPIGeneration(get().parsedServerURL) === 'v3';

	const signOutLocally = () => {
		retireAuthentication();
		set({ authState: 'login' });
		setCacheSessionIdentity();
		clearSessionState();
		needsConnectionBootstrapRetry = false;
		const parsed = get().parsedServerURL;
		CredentialBinding.unbind(parsed ? canonicalServerOrigin(parsed) : undefined);
		ResponseCache.invalidateAll();
	};

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
			configureClient(url, true);
			await new Promise((resolve) => setTimeout(resolve, 500));
			requireCurrentAuthentication(generation);
			const result = await runBootstrapOperation(url, operation);
			requireCurrentAuthentication(generation);
			configureClient(url);
			return result;
		}
	};

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
		const loadsPermissions = capabilities.mode === 'rbac';
		const bootstrap = await sessionBootstrapIfAvailable(client);
		if (!isCurrentAuthentication(generation)) return;
		if (bootstrap) {
			const environments = bootstrap.environments;
			bootstrapEnvironments =
				environments.pagination.totalItems >= 0 &&
				environments.data.length >= environments.pagination.totalItems
					? { session: get().cacheSessionIdentity, environments: environments.data }
					: undefined;
			rememberAPIGeneration(get().parsedServerURL, 'v3');
			set({
				...previewModes('v3'),
				currentUser: bootstrap.user,
				serverCapabilities: ServerCapabilities.make(
					ServerCapabilities.detect(bootstrap.user),
					bootstrap.version.enabledFeatures ?? []
				),
				permissionsManifest: bootstrap.permissionsManifest,
				supportsPost26MobileFeatures: VersionInfo.supportsPost26MobileFeatures(bootstrap.version),
				supportsMobilePush: VersionInfo.supportsMobilePush(bootstrap.version),
				apiGeneration: 'v3',
				pendingMFAChallenge: undefined,
				authState: 'authenticated'
			});
			bumpAccess();
			return;
		}
		const [manifest, versionInfo, apiGeneration] = await Promise.all([
			loadsPermissions
				? client.roles.availablePermissions().catch(() => undefined)
				: Promise.resolve(undefined),
			client.version.appVersion().catch(() => undefined),
			client.apiGeneration().then(() => client.currentAPIGeneration())
		]);
		if (!isCurrentAuthentication(generation)) return;
		rememberAPIGeneration(get().parsedServerURL, apiGeneration);
		set({
			...previewModes(apiGeneration),
			permissionsManifest: loadsPermissions ? manifest : undefined,
			supportsPost26MobileFeatures: versionInfo
				? VersionInfo.supportsPost26MobileFeatures(versionInfo)
				: false,
			supportsMobilePush: versionInfo ? VersionInfo.supportsMobilePush(versionInfo) : false,
			apiGeneration,
			pendingMFAChallenge: undefined,
			authState: 'authenticated'
		});
		bumpAccess();
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

	const isUserCancellation = (error: unknown) =>
		isCancellation(error) || (error instanceof CeremonyError && error.kind === 'cancelled');

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

	const fetchGravatar = async (user: User, client: ArcaneClient, generation: number) => {
		const email = user.email?.trim().toLowerCase();
		if (!email) return undefined;
		try {
			const settings = await client.settings.getSettings({ envID: EnvironmentID.localDocker });
			if (!isCurrentAuthentication(generation)) return undefined;
			if (settings.find((s) => s.key === 'enableGravatar')?.value.toLowerCase() !== 'true')
				return undefined;
		} catch {
			return undefined;
		}
		const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, email);
		return get().fetchImageData(`https://www.gravatar.com/avatar/${hash}?s=160&d=404`);
	};

	const savedURL = storage.string(Keys.serverURL) ?? '';
	const initialParsed = savedURL ? normalizeServerURLInput(savedURL) && savedURL : undefined;
	let initialClient: ArcaneClient | undefined;
	if (initialParsed) {
		const origin = canonicalServerOrigin(initialParsed);
		if (origin && CredentialBinding.origin === undefined) CredentialBinding.bind(origin);
		initialClient = makeClient(initialParsed, false);
		configuredClientURL = initialParsed;
	}
	const savedEnvID = storage.string(Keys.activeEnvironmentID);
	if (savedEnvID === undefined) {
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
		apiGeneration: undefined,
		takeBootstrapEnvironments: (sessionIdentity) => {
			const seeded = bootstrapEnvironments;
			bootstrapEnvironments = undefined;
			return seeded?.session === sessionIdentity ? seeded.environments : undefined;
		},
		isDemoActive: false,
		isStartingDemo: false,
		demoEndsAt: undefined,
		demoExpiredMessage: undefined,
		...previewModes(rememberedAPIGeneration(initialParsed)),
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

		configure: (url) => {
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
			if (usesV3Defaults()) return;
			storage.set(Keys.allEnvironmentsPreview, enabled);
			set({ allEnvironmentsPreview: enabled });
			bumpAccess();
		},

		setRefreshedDashboardPreview: (enabled) => {
			if (usesV3Defaults()) return;
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

			const endingClient = get().client;
			const parsed = get().parsedServerURL;
			const endingOrigin = parsed ? canonicalServerOrigin(parsed) : undefined;
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

		checkExistingAuth: async () => {
			const generation = get().authenticationGeneration;
			const client = get().client;
			if (!client) {
				if (get().authState === 'authenticating') set({ authState: 'login' });
				return;
			}

			let hasCredential: boolean;
			try {
				hasCredential = await client.authManager.hasRefreshCredential();
			} catch {
				hasCredential = true;
			}
			if (!isCurrentAuthentication(generation)) return;
			if (!hasCredential) {
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
					signOutLocally();
					await refreshLoginCapabilities();
					return;
				}
				await keepSignedInIfCredentialPresent(client, error, generation);
			}
		},

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
