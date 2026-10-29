import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import {
	androidPushChannelID,
	installationRequestBody,
	isUnsupportedPlatformError,
	pushPlatformFor,
	tokenUpdateBody
} from '@/core/push-relay';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { CancellationError, isArcaneError } from '@/sdk/errors/ArcaneError';
import type { MobilePushDevice, MobilePushStatus } from '@/sdk/models/mobilePush/MobilePush';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { ArcaneFirebase } from '../../modules/arcane-firebase';

export type PushAuthorizationStatus =
	| 'notDetermined'
	| 'denied'
	| 'authorized'
	| 'provisional'
	| 'ephemeral';

export type PushServerBinding = { recipientId: string; channelId: string; deviceId: string };

export type PushCredentials = {
	relayURL: string;
	installationId: string;
	installationSecret: string;
	deviceToken: string;
	apnsEnvironment: string;
	bindings: Record<string, PushServerBinding>;
};

const supportedPushPlatform = pushPlatformFor(Platform.OS);
const pushPlatform = supportedPushPlatform ?? 'apns';

export const systemNotificationSettingsName =
	pushPlatform === 'fcm' ? 'Android Settings' : 'iOS Settings';

export class PushError extends Error {
	static serverDisabled = () =>
		new PushError("Your Arcane admin hasn't enabled mobile push notifications.");
	static notAuthorized = () =>
		new PushError(`Notifications are turned off for Arcane in ${systemNotificationSettingsName}.`);
	static noDeviceToken = () =>
		new PushError(
			pushPlatform === 'fcm'
				? "Couldn't register this device with Firebase Cloud Messaging."
				: "Couldn't register this device with Apple Push Notifications."
		);
	static relayPlatformUnsupported = () =>
		new PushError("This push relay doesn't support Android notifications yet.");
	static relay = (status: number, message: string) =>
		new PushError(`Push relay error (${status}): ${message}`);
	static firebaseNotConfigured = () =>
		new PushError('Enter your Firebase settings in App Settings before you turn on push.');
	static notSignedIn = () => new PushError('Sign in to enable push notifications.');
}

const keychainKey = 'com.arcane.mobile.push.relay';
const keychainOptions: SecureStore.SecureStoreOptions = {
	keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK
};

const PushKeychain = {
	async load(): Promise<PushCredentials | undefined> {
		try {
			const raw = await SecureStore.getItemAsync(keychainKey, keychainOptions);
			if (!raw) return undefined;
			const parsed = JSON.parse(raw) as Partial<PushCredentials>;
			if (typeof parsed.relayURL !== 'string' || typeof parsed.installationId !== 'string')
				return undefined;
			return { ...(parsed as PushCredentials), bindings: parsed.bindings ?? {} };
		} catch {
			return undefined;
		}
	},
	async save(credentials: PushCredentials | undefined) {
		try {
			if (!credentials) await SecureStore.deleteItemAsync(keychainKey, keychainOptions);
			else
				await SecureStore.setItemAsync(keychainKey, JSON.stringify(credentials), keychainOptions);
		} catch {}
	}
};

let apnsEnvironmentPromise: Promise<string> | undefined;

function detectAPNSEnvironment(): Promise<string> {
	apnsEnvironmentPromise ??= (async () => {
		if (pushPlatform === 'fcm') return '';
		if (!Device.isDevice) return 'sandbox';
		try {
			return (await Application.getIosPushNotificationServiceEnvironmentAsync()) === 'development'
				? 'sandbox'
				: 'production';
		} catch {
			return 'production';
		}
	})();
	return apnsEnvironmentPromise;
}

async function ensureAndroidChannel() {
	if (pushPlatform !== 'fcm') return;
	await Notifications.setNotificationChannelAsync(androidPushChannelID, {
		name: 'Alerts',
		importance: Notifications.AndroidImportance.HIGH
	});
}

function authorizationStatus(
	permissions: Notifications.NotificationPermissionsStatus
): PushAuthorizationStatus {
	switch (permissions.ios?.status) {
		case Notifications.IosAuthorizationStatus.DENIED:
			return 'denied';
		case Notifications.IosAuthorizationStatus.AUTHORIZED:
			return 'authorized';
		case Notifications.IosAuthorizationStatus.PROVISIONAL:
			return 'provisional';
		case Notifications.IosAuthorizationStatus.EPHEMERAL:
			return 'ephemeral';
		default:
			if (permissions.status === 'granted') return 'authorized';
			return permissions.status === 'denied' && !permissions.canAskAgain
				? 'denied'
				: 'notDetermined';
	}
}

type InstallationResponse = { installationId: string; installationSecret: string };
type PairResponse = { recipientId: string; channelId: string };

async function relayData(
	creds: PushCredentials,
	method: string,
	path: string,
	body: Record<string, string>,
	authorized: boolean
): Promise<string> {
	let url: string;
	try {
		url = new URL(creds.relayURL + path).toString();
	} catch {
		throw PushError.relay(0, 'invalid relay URL');
	}
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (authorized)
		headers.Authorization = `Bearer ${creds.installationId}.${creds.installationSecret}`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 20_000);
	try {
		const response = await fetch(url, {
			method,
			headers,
			body: JSON.stringify(body),
			credentials: 'omit',
			cache: 'no-store',
			signal: controller.signal
		});
		const text = await response.text();
		if (response.status < 200 || response.status >= 300) {
			let message = text;
			try {
				const decoded = JSON.parse(text) as { error?: { message?: unknown } };
				if (typeof decoded.error?.message === 'string') message = decoded.error.message;
			} catch {}
			if (isUnsupportedPlatformError(response.status, message))
				throw PushError.relayPlatformUnsupported();
			throw PushError.relay(response.status, message);
		}
		return text;
	} finally {
		clearTimeout(timer);
	}
}

async function relayRequest<T>(
	creds: PushCredentials,
	method: string,
	path: string,
	body: Record<string, string>,
	authorized: boolean
): Promise<T> {
	return JSON.parse(await relayData(creds, method, path, body, authorized)) as T;
}

async function relayRequestVoid(
	creds: PushCredentials,
	method: string,
	path: string,
	body: Record<string, string>
) {
	await relayData(creds, method, path, body, true);
}

function updateRelayToken(creds: PushCredentials) {
	return relayRequestVoid(
		creds,
		'PUT',
		`/v1/installations/${creds.installationId}/token`,
		tokenUpdateBody(pushPlatform, creds.deviceToken, creds.apnsEnvironment)
	);
}

type PushNotificationState = {
	authorizationStatus: PushAuthorizationStatus;
	isBusy: boolean;
	serverStatus: MobilePushStatus | undefined;
	errorMessage: string | undefined;
	credentials: PushCredentials | undefined;
	firebaseReady: boolean;

	isSupported: boolean;
	isEnabled: (origin: string | undefined) => boolean;
	binding: (origin: string | undefined) => PushServerBinding | undefined;
	isAuthorizationDenied: () => boolean;

	observeDeviceToken: () => () => void;
	firebaseDidChange: () => Promise<void>;
	sessionDidChange: () => void;
	refreshAuthorizationStatus: () => Promise<void>;
	registerIfAuthorized: () => Promise<void>;
	refreshServerStatus: () => Promise<void>;
	didRegister: (deviceToken: string) => Promise<void>;
	enable: () => Promise<void>;
	disable: () => Promise<void>;
	tearDown: (client: ArcaneClient | undefined, origin: string | undefined) => Promise<void>;
};

let nextOperationID = 0;

export const usePushNotificationCoordinator = create<PushNotificationState>((set, get) => {
	let operationID = nextOperationID;
	let latestDeviceToken: string | undefined;
	const credentialsLoaded = PushKeychain.load().then((credentials) => {
		if (get().credentials === undefined) set({ credentials });
	});

	const persist = () => void PushKeychain.save(get().credentials);

	const setCredentials = (credentials: PushCredentials | undefined) => {
		set({ credentials });
		persist();
	};

	const awaitDeviceToken = async (): Promise<string> => {
		if (latestDeviceToken) return latestDeviceToken;
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			const token = await Promise.race([
				Notifications.getDevicePushTokenAsync(),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => reject(PushError.noDeviceToken()), 15_000);
				})
			]);
			if (typeof token.data !== 'string' || token.data === '') throw PushError.noDeviceToken();
			latestDeviceToken = token.data;
			return token.data;
		} finally {
			clearTimeout(timer);
		}
	};

	const ensureInstallation = async (
		relayURL: string,
		deviceToken: string,
		checkSession: () => void
	): Promise<PushCredentials> => {
		const environment = await detectAPNSEnvironment();
		const creds = get().credentials;
		if (creds && creds.relayURL === relayURL) {
			if (creds.deviceToken !== deviceToken || creds.apnsEnvironment !== environment) {
				const updated = { ...creds, deviceToken, apnsEnvironment: environment };
				await updateRelayToken(updated);
				checkSession();
				const current = get().credentials;
				if (current?.installationId !== updated.installationId) throw new CancellationError();
				const next = { ...current, deviceToken, apnsEnvironment: environment };
				setCredentials(next);
				return next;
			}
			return creds;
		}
		const bootstrap: PushCredentials = {
			relayURL,
			installationId: '',
			installationSecret: '',
			deviceToken,
			apnsEnvironment: environment,
			bindings: {}
		};
		const created = await relayRequest<InstallationResponse>(
			bootstrap,
			'POST',
			'/v1/installations',
			installationRequestBody(
				pushPlatform,
				deviceToken,
				environment,
				Application.nativeApplicationVersion ?? 'unknown'
			),
			false
		);
		const next: PushCredentials = {
			relayURL,
			installationId: created.installationId,
			installationSecret: created.installationSecret,
			deviceToken,
			apnsEnvironment: environment,
			bindings: {}
		};
		checkSession();
		setCredentials(next);
		return next;
	};

	return {
		authorizationStatus: 'notDetermined',
		isBusy: false,
		serverStatus: undefined,
		errorMessage: undefined,
		credentials: undefined,
		firebaseReady: pushPlatform !== 'fcm' || ArcaneFirebase.isInitialized(),

		isSupported: supportedPushPlatform !== undefined,
		isEnabled: (origin) => get().binding(origin) !== undefined,
		binding: (origin) => (origin ? get().credentials?.bindings[origin] : undefined),
		isAuthorizationDenied: () => get().authorizationStatus === 'denied',

		observeDeviceToken: () => {
			if (!get().isSupported) return () => {};
			void get().registerIfAuthorized();
			const subscription = Notifications.addPushTokenListener((token) => {
				if (typeof token.data === 'string') void get().didRegister(token.data);
			});
			return () => subscription.remove();
		},

		firebaseDidChange: async () => {
			latestDeviceToken = undefined;
			set({
				firebaseReady: pushPlatform !== 'fcm' || ArcaneFirebase.isInitialized(),
				errorMessage: undefined
			});
			if (get().firebaseReady) await get().registerIfAuthorized();
		},

		sessionDidChange: () => {
			operationID = ++nextOperationID;
			set({ isBusy: false, serverStatus: undefined, errorMessage: undefined });
		},

		refreshAuthorizationStatus: async () => {
			if (!get().isSupported) return;
			set({ authorizationStatus: authorizationStatus(await Notifications.getPermissionsAsync()) });
		},

		registerIfAuthorized: async () => {
			if (!get().isSupported) return;
			await get().refreshAuthorizationStatus();
			const status = get().authorizationStatus;
			if (status !== 'authorized' && status !== 'provisional') return;
			try {
				await ensureAndroidChannel();
				const token = await Notifications.getDevicePushTokenAsync();
				if (typeof token.data === 'string') await get().didRegister(token.data);
			} catch {}
		},

		refreshServerStatus: async () => {
			const manager = useClientManager.getState();
			const client = manager.client;
			if (!get().isSupported || !manager.supportsMobilePush || !client) {
				set({ serverStatus: undefined });
				return;
			}
			await credentialsLoaded;
			const generation = manager.authenticationGeneration;
			const origin = manager.serverOrigin();
			const status = await client.mobilePush.status().catch(() => undefined);
			if (!useClientManager.getState().isCurrentAuthentication(generation)) return;
			set({ serverStatus: status });
			const binding = get().binding(origin);
			const creds = get().credentials;
			if (
				status &&
				origin &&
				binding &&
				creds &&
				(!status.enabled || !status.devices.some((d) => d.id === binding.deviceId))
			) {
				const bindings = { ...creds.bindings };
				delete bindings[origin];
				setCredentials({ ...creds, bindings });
			}
		},

		didRegister: async (token) => {
			latestDeviceToken = token;
			await credentialsLoaded;
			const environment = await detectAPNSEnvironment();
			const creds = get().credentials;
			if (!creds || (creds.deviceToken === token && creds.apnsEnvironment === environment)) return;
			const updated = { ...creds, deviceToken: token, apnsEnvironment: environment };
			try {
				await updateRelayToken(updated);
				const current = get().credentials;
				if (latestDeviceToken !== token || current?.installationId !== updated.installationId)
					return;
				setCredentials({ ...current, deviceToken: token, apnsEnvironment: environment });
			} catch (error) {
				if (
					latestDeviceToken !== token ||
					get().credentials?.installationId !== updated.installationId
				)
					return;
				set({ errorMessage: error instanceof Error ? error.message : String(error) });
			}
		},

		enable: async () => {
			if (get().isBusy) return;
			const id = ++nextOperationID;
			operationID = id;
			const generation = useClientManager.getState().authenticationGeneration;
			set({ isBusy: true, errorMessage: undefined });
			const checkSession = () => {
				if (operationID !== id || !useClientManager.getState().isCurrentAuthentication(generation))
					throw new CancellationError();
			};
			try {
				await credentialsLoaded;
				const manager = useClientManager.getState();
				const client = manager.client;
				const origin = manager.serverOrigin();
				if (!client || !origin) throw PushError.notSignedIn();
				if (!get().firebaseReady) throw PushError.firebaseNotConfigured();
				await ensureAndroidChannel();
				checkSession();
				const permissions = await Notifications.requestPermissionsAsync({
					ios: { allowAlert: true, allowSound: true, allowBadge: true }
				});
				checkSession();
				set({ authorizationStatus: authorizationStatus(permissions) });
				checkSession();
				if (!permissions.granted) throw PushError.notAuthorized();

				const status = await client.mobilePush.status();
				checkSession();
				set({ serverStatus: status });
				if (!status.enabled) throw PushError.serverDisabled();

				const token = await awaitDeviceToken();
				checkSession();
				const creds = await ensureInstallation(status.relayUrl, token, checkSession);
				checkSession();

				const label =
					Device.deviceName ?? Device.modelName ?? (pushPlatform === 'fcm' ? 'Android' : 'iPhone');
				const pairing = await client.mobilePush.pairingToken();
				checkSession();
				let paired = await relayRequest<PairResponse>(
					creds,
					'POST',
					'/v1/pair',
					{ pairingToken: pairing.token },
					true
				);
				checkSession();
				let device: MobilePushDevice;
				try {
					checkSession();
					device = await client.mobilePush.registerDevice({
						body: { recipientId: paired.recipientId, label }
					});
				} catch (error) {
					checkSession();
					if (!isArcaneError(error, 'conflict')) throw error;
					await relayRequestVoid(creds, 'POST', '/v1/unpair', {
						recipientId: paired.recipientId
					}).catch(() => undefined);
					checkSession();
					const retryPairing = await client.mobilePush.pairingToken();
					checkSession();
					paired = await relayRequest<PairResponse>(
						creds,
						'POST',
						'/v1/pair',
						{ pairingToken: retryPairing.token },
						true
					);
					checkSession();
					device = await client.mobilePush.registerDevice({
						body: { recipientId: paired.recipientId, label }
					});
				}
				checkSession();
				const current = get().credentials;
				if (current?.installationId !== creds.installationId) throw new CancellationError();
				setCredentials({
					...current,
					bindings: {
						...current.bindings,
						[origin]: {
							recipientId: paired.recipientId,
							channelId: paired.channelId,
							deviceId: device.id
						}
					}
				});
				const updatedStatus = await client.mobilePush.status().catch(() => undefined);
				checkSession();
				set({ serverStatus: updatedStatus });
				showToast(Toasts.success('Push notifications enabled'));
			} catch (error) {
				if (
					operationID !== id ||
					!useClientManager.getState().isCurrentAuthentication(generation) ||
					isCancellation(error)
				)
					return;
				const message = friendlyErrorMessage(error);
				set({ errorMessage: message });
				showToast(Toasts.error(message));
			} finally {
				if (operationID === id) set({ isBusy: false });
			}
		},

		disable: async () => {
			if (get().isBusy) return;
			const id = ++nextOperationID;
			operationID = id;
			const manager = useClientManager.getState();
			const generation = manager.authenticationGeneration;
			set({ isBusy: true, errorMessage: undefined });
			try {
				const client = manager.client;
				await get().tearDown(client, manager.serverOrigin());
				if (operationID !== id || !useClientManager.getState().isCurrentAuthentication(generation))
					return;
				const status = await client?.mobilePush.status().catch(() => undefined);
				if (operationID !== id || !useClientManager.getState().isCurrentAuthentication(generation))
					return;
				set({ serverStatus: status });
				showToast(Toasts.info('Push notifications disabled'));
			} finally {
				if (operationID === id) set({ isBusy: false });
			}
		},

		tearDown: async (client, origin) => {
			await credentialsLoaded;
			const creds = get().credentials;
			const binding = origin ? creds?.bindings[origin] : undefined;
			if (!origin || !creds || !binding) return;
			const bindings = { ...creds.bindings };
			delete bindings[origin];
			setCredentials({ ...creds, bindings });
			await relayRequestVoid(creds, 'POST', '/v1/unpair', {
				recipientId: binding.recipientId
			}).catch(() => undefined);
			await client?.mobilePush.deleteDevice({ id: binding.deviceId }).catch(() => undefined);
		}
	};
});
