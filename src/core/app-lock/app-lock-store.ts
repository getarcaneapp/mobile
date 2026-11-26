import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

import { Keys, storage } from '@/core/storage';

import { AppLockGrace, shouldLockOnResume, type BiometryKind } from './app-lock-policy';

type AppLockState = {
	isLocked: boolean;
	isCovered: boolean;
	isAuthenticating: boolean;
	biometry: BiometryKind;
	unlock: () => Promise<void>;
};

const isEnabled = () => storage.bool(Keys.appLockEnabled) ?? false;
const graceSeconds = () => AppLockGrace.from(storage.number(Keys.appLockGraceSeconds));

export const useAppLock = create<AppLockState>((set, get) => ({
	isLocked: isEnabled(),
	isCovered: false,
	isAuthenticating: false,
	biometry: 'none',
	unlock: async () => {
		if (get().isAuthenticating) return;
		set({ isAuthenticating: true });
		const success = await authenticate('Unlock Arcane');
		set(success ? { isAuthenticating: false, isLocked: false } : { isAuthenticating: false });
	}
}));

let prompting = false;

async function authenticate(promptMessage: string): Promise<boolean> {
	prompting = true;
	const result = await LocalAuthentication.authenticateAsync({
		promptMessage,
		cancelLabel: 'Cancel',
		disableDeviceFallback: false
	}).catch(() => undefined);
	prompting = false;
	return result?.success ?? false;
}

async function detectBiometry(): Promise<BiometryKind> {
	const [enrolled, types] = await Promise.all([
		LocalAuthentication.isEnrolledAsync().catch(() => false),
		LocalAuthentication.supportedAuthenticationTypesAsync().catch(
			() => [] as LocalAuthentication.AuthenticationType[]
		)
	]);
	if (!enrolled) return 'none';
	const ios = Platform.OS === 'ios';
	if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION))
		return ios ? 'faceID' : 'face';
	if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT))
		return ios ? 'touchID' : 'fingerprint';
	if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return ios ? 'opticID' : 'iris';
	return 'none';
}

export type AppLockAvailability = 'available' | 'noDeviceSecurity';

async function availability(): Promise<AppLockAvailability> {
	const level = await LocalAuthentication.getEnrolledLevelAsync().catch(
		() => LocalAuthentication.SecurityLevel.NONE
	);
	return level === LocalAuthentication.SecurityLevel.NONE ? 'noDeviceSecurity' : 'available';
}

export const AppLock = {
	availability,

	async setEnabled(enabled: boolean): Promise<boolean> {
		if (enabled === isEnabled()) return true;
		if (enabled && (await availability()) !== 'available') return false;
		const confirmed = await authenticate(enabled ? 'Turn on App Lock' : 'Turn off App Lock');
		if (!confirmed) return false;
		storage.set(Keys.appLockEnabled, enabled);
		useAppLock.setState({ isLocked: false });
		return true;
	},

	start(): () => void {
		let backgroundedAt: number | undefined;
		let promptedAtLaunch = false;
		void detectBiometry().then((biometry) => useAppLock.setState({ biometry }));
		const onChange = (state: AppStateStatus) => {
			const enabled = isEnabled();
			if (state === 'background') {
				backgroundedAt ??= Date.now();
				useAppLock.setState({ isCovered: enabled });
				return;
			}
			if (state === 'inactive') {
				if (enabled && !prompting) useAppLock.setState({ isCovered: true });
				return;
			}
			const resumed = backgroundedAt !== undefined;
			const lock = shouldLockOnResume(enabled, backgroundedAt, Date.now(), graceSeconds());
			backgroundedAt = undefined;
			useAppLock.setState((current) => ({
				isCovered: false,
				isLocked: current.isLocked || lock
			}));
			const prompts = resumed || !promptedAtLaunch;
			promptedAtLaunch = true;
			if (prompts && useAppLock.getState().isLocked) void useAppLock.getState().unlock();
		};
		const subscription = AppState.addEventListener('change', onChange);
		if (AppState.currentState === 'active') {
			promptedAtLaunch = true;
			if (useAppLock.getState().isLocked) void useAppLock.getState().unlock();
		}
		return () => subscription.remove();
	}
};
