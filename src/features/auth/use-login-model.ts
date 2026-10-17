import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
	ConnectionProfileSync,
	SavedConnectionCredential,
	type ConnectionProfile
} from '@/core/connection-profiles/connection-profile-sync';
import { ConnectionProfileCopy } from '@/core/connection-profiles/connection-profile-copy';
import { hostAndPort } from '@/core/networking/server-identity';
import { useClientManager } from '@/stores/client-manager';
import { useConnectionProfileSelection } from '@/stores/connection-profile-selection';
import { useConnectionProfileStore } from '@/stores/connection-profile-store';
import { useLaunchSplash } from '@/stores/launch-splash-store';
import { useAccentColor } from '@/theme/accent';
import { showToast, Toasts } from '@/ui/toast';

export type LoginField = 'serverURL' | 'username' | 'password' | 'recoveryCode';

type PendingPasswordCredentialChange = { serverURL: string; username: string; password: string };

export type SavedSignInOffer = {
	profile: ConnectionProfile;
	credential: SavedConnectionCredential;
};

const passwordManagerOffered = new Set<string>();

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useLoginModel() {
	const router = useRouter();
	const brandColor = useAccentColor();
	const manager = useClientManager();
	const credentialProfileIDs = useConnectionProfileStore((s) => s.credentialProfileIDs);
	const isLaunchSplashPresented = useLaunchSplash((s) => s.isPresented);

	const mode: 'setup' | 'login' = manager.authState === 'setup' ? 'setup' : 'login';

	const [serverURL, setServerURLState] = useState(manager.serverURL);
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [recoveryCode, setRecoveryCode] = useState('');
	const [showSetup, setShowSetup] = useState(false);
	const [showsPasswordForm, setShowsPasswordForm] = useState(false);
	const [savedSignInOffer, setSavedSignInOffer] = useState<SavedSignInOffer>();
	const [isUsingSavedSignIn, setIsUsingSavedSignIn] = useState(false);
	const [focusedField, setFocusedField] = useState<LoginField | null>(null);
	const [fieldsRevision, setFieldsRevision] = useState(0);
	const pendingPasswordCredentialChange = useRef<PendingPasswordCredentialChange | undefined>(
		undefined
	);
	const savedSignInAttemptID = useRef<number | undefined>(undefined);
	const focusImpl = useRef<(field: LoginField | null) => void>(() => {});
	const latest = useRef({ username, password });
	latest.current = { username, password };

	const isSetupMode = mode === 'setup' || showSetup;
	const isLocalAuthAvailable = manager.isLocalAuthAvailable();
	const isOIDCAvailable = manager.isOIDCAvailable();
	const shouldShowPasswordFields = isLocalAuthAvailable && (!isOIDCAvailable || showsPasswordForm);

	const focus = (field: LoginField | null) => {
		if (field === null) setFocusedField(null);
		focusImpl.current(field);
	};

	const assignFields = (next: {
		serverURL?: string;
		username?: string;
		password?: string;
		recoveryCode?: string;
	}) => {
		if (next.serverURL !== undefined) setServerURLState(next.serverURL);
		if (next.username !== undefined) setUsername(next.username);
		if (next.password !== undefined) setPassword(next.password);
		if (next.recoveryCode !== undefined) setRecoveryCode(next.recoveryCode);
		setFieldsRevision((r) => r + 1);
	};

	const setServerURL = (value: string) => {
		setServerURLState(value);
		if (useClientManager.getState().errorMessage !== undefined) manager.setErrorMessage(undefined);
	};

	const resetPasswordSignIn = () => {
		pendingPasswordCredentialChange.current = undefined;
		setSavedSignInOffer(undefined);
		assignFields({ username: '', password: '' });
		setShowsPasswordForm(false);
		setIsUsingSavedSignIn(false);
		savedSignInAttemptID.current = undefined;
	};

	const offerSavedCredential = (profile: ConnectionProfile | undefined) => {
		resetPasswordSignIn();
		if (!useClientManager.getState().isLocalAuthAvailable() || !profile) return;
		try {
			const credential = useConnectionProfileStore.getState().savedCredential(profile);
			if (credential) setSavedSignInOffer({ profile, credential });
			else if (Platform.OS === 'android') offerPasswordManagerCredential(profile);
		} catch (error) {
			showToast(Toasts.error(errorText(error)));
		}
	};

	const offerPasswordManagerCredential = (profile: ConnectionProfile) => {
		if (passwordManagerOffered.has(profile.id)) return;
		passwordManagerOffered.add(profile.id);
		void (async () => {
			const credential = await useConnectionProfileStore
				.getState()
				.pickPasswordManagerCredential(profile);
			if (!credential) return;
			const { username: u, password: p } = latest.current;
			if (u || p) return;
			if (
				useConnectionProfileStore.getState().profile(useClientManager.getState().serverURL)?.id !==
				profile.id
			)
				return;
			useSavedSignIn({ profile, credential });
		})();
	};

	const savePasswordSignIn = (pending: PendingPasswordCredentialChange) => {
		const state = useClientManager.getState();
		if (state.authState !== 'authenticated') return;
		try {
			if (
				ConnectionProfileSync.normalizedServerURL(state.serverURL) !==
				ConnectionProfileSync.normalizedServerURL(pending.serverURL)
			) {
				return;
			}
		} catch {
			return;
		}
		try {
			const credential = SavedConnectionCredential.make(pending.username, pending.password);
			useConnectionProfileStore.getState().saveConnectedServer(pending.serverURL, credential);
		} catch (error) {
			showToast(Toasts.error(errorText(error)));
		}
	};

	const performPasswordSignIn = async (pending: PendingPasswordCredentialChange) => {
		await useClientManager.getState().login(pending.username, pending.password);
		const state = useClientManager.getState();
		if (state.authState === 'authenticated') {
			pendingPasswordCredentialChange.current = undefined;
			savePasswordSignIn(pending);
		} else if (state.pendingMFAChallenge === undefined) {
			pendingPasswordCredentialChange.current = undefined;
		}
	};

	const useSavedSignIn = (offer: SavedSignInOffer) => {
		setSavedSignInOffer(undefined);
		focus(null);
		assignFields({ username: offer.credential.username, password: offer.credential.password });
		setShowsPasswordForm(true);
		setIsUsingSavedSignIn(true);
		const attemptID = Date.now() + Math.random();
		savedSignInAttemptID.current = attemptID;
		void (async () => {
			await useClientManager.getState().refreshLoginCapabilities();
			if (savedSignInAttemptID.current !== attemptID) return;
			const state = useClientManager.getState();
			if (!state.isLocalAuthAvailable()) {
				resetPasswordSignIn();
				showToast(Toasts.info(`Password sign-in is disabled on ${offer.profile.name}`));
				return;
			}
			if (useConnectionProfileStore.getState().profile(state.serverURL)?.id !== offer.profile.id) {
				resetPasswordSignIn();
				return;
			}
			const pending = {
				serverURL: offer.profile.serverURL,
				username: offer.credential.username,
				password: offer.credential.password
			};
			pendingPasswordCredentialChange.current = pending;
			await performPasswordSignIn(pending);
			if (savedSignInAttemptID.current !== attemptID) return;
			savedSignInAttemptID.current = undefined;
			setIsUsingSavedSignIn(false);
		})();
	};

	useEffect(() => {
		if (manager.isStartingDemo) focus(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [manager.isStartingDemo]);

	useEffect(() => {
		if (!shouldShowPasswordFields) focus(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shouldShowPasswordFields]);

	useEffect(() => {
		if (isLocalAuthAvailable) return;
		setSavedSignInOffer(undefined);
		assignFields({ username: '', password: '' });
		setIsUsingSavedSignIn(false);
		savedSignInAttemptID.current = undefined;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLocalAuthAvailable]);

	const previousCredentialIDs = useRef(credentialProfileIDs);
	useEffect(() => {
		const previous = previousCredentialIDs.current;
		previousCredentialIDs.current = credentialProfileIDs;
		const { username: u, password: p } = latest.current;
		if (isSetupMode || isLaunchSplashPresented || u || p) return;
		const profile = useConnectionProfileStore
			.getState()
			.profile(useClientManager.getState().serverURL);
		if (!profile || previous.has(profile.id) || !credentialProfileIDs.has(profile.id)) return;
		offerSavedCredential(profile);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [credentialProfileIDs]);

	useEffect(() => {
		if (isSetupMode || !manager.serverURL) return;
		void useClientManager.getState().refreshLoginCapabilities();
	}, [isSetupMode, manager.serverURL, manager.clientGeneration]);

	useEffect(() => {
		if (isLaunchSplashPresented) {
			focus(null);
			return;
		}
		const timer = setTimeout(() => {
			const state = useClientManager.getState();
			if (state.isStartingDemo) return;
			let offered = false;
			if (!isSetupMode) {
				const profile = useConnectionProfileStore.getState().profile(state.serverURL);
				offerSavedCredential(profile);
				offered =
					profile !== undefined && useConnectionProfileStore.getState().hasSavedCredential(profile);
			}
			if (offered) {
				focus(null);
				return;
			}
			if (isSetupMode) focus('serverURL');
			else if (state.pendingMFAChallenge) focus('recoveryCode');
			else if (state.isLocalAuthAvailable() && (!state.isOIDCAvailable() || showsPasswordForm))
				focus('username');
		}, 350);
		return () => clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLaunchSplashPresented]);

	const connectToServer = () => {
		focus(null);
		manager.configure(serverURL);
		const state = useClientManager.getState();
		if (state.errorMessage !== undefined) return;
		assignFields({ serverURL: state.serverURL });
		try {
			const profile = useConnectionProfileStore.getState().saveConnectedServer(state.serverURL);
			offerSavedCredential(profile);
		} catch {
			resetPasswordSignIn();
			showToast(Toasts.info("Connected server wasn't saved as a profile"));
		}
		setShowSetup(false);
	};

	const connect = (profile: ConnectionProfile) => {
		focus(null);
		resetPasswordSignIn();
		assignFields({ serverURL: profile.serverURL });
		useClientManager.getState().configure(profile.serverURL);
		if (useClientManager.getState().errorMessage !== undefined) return;
		setShowSetup(false);
		setTimeout(() => {
			const current = useConnectionProfileStore
				.getState()
				.profile(useClientManager.getState().serverURL);
			if (current?.id === profile.id) offerSavedCredential(profile);
		}, 350);
	};

	const signIn = () => {
		if (!useClientManager.getState().isLocalAuthAvailable()) return;
		focus(null);
		const pending = { serverURL: manager.serverURL, username, password };
		pendingPasswordCredentialChange.current = pending;
		void performPasswordSignIn(pending);
	};

	const finishMFA = async (complete: () => Promise<void>) => {
		focus(null);
		const pending = pendingPasswordCredentialChange.current;
		await complete();
		if (pending && useClientManager.getState().authState === 'authenticated') {
			pendingPasswordCredentialChange.current = undefined;
			savePasswordSignIn(pending);
		}
	};

	return {
		mode,
		brandColor,
		serverURL,
		username,
		password,
		recoveryCode,
		setServerURL,
		setUsername,
		setPassword,
		setRecoveryCode,
		fieldsRevision,
		focusedField,
		isSetupMode,
		isLoading: manager.isLoading,
		isStartingDemo: manager.isStartingDemo,
		isOIDCSigningIn: manager.isOIDCSigningIn,
		isPasskeySigningIn: manager.isPasskeySigningIn,
		isUsingSavedSignIn,
		errorMessage: manager.errorMessage,
		demoExpiredMessage: manager.demoExpiredMessage,
		pendingMFAChallenge: manager.pendingMFAChallenge,
		isLocalAuthAvailable,
		isOIDCAvailable,
		showsPasswordForm,
		shouldShowPasswordFields,
		providerDisplayName: manager.loginCapabilities?.oidcProviderName || 'OIDC',
		headerSubtitle: manager.isStartingDemo
			? 'Setting things up for you…'
			: isSetupMode
				? 'Connect to your Arcane server'
				: manager.pendingMFAChallenge
					? 'Use a passkey or a recovery code to finish signing in'
					: 'Sign in to continue',
		showsServerChip: !isSetupMode && !manager.isStartingDemo && !manager.pendingMFAChallenge,
		showsDemoBanner: !manager.pendingMFAChallenge,
		serverDisplayName: hostAndPort(manager.serverURL) ?? manager.serverURL,
		secondaryDisabled: manager.isLoading || manager.isOIDCSigningIn || manager.isPasskeySigningIn,
		savedSignInOffer,
		savedSignInPrompt: ConnectionProfileCopy.savedSignInPrompt,

		bindFocus: (impl: (field: LoginField | null) => void) => {
			focusImpl.current = impl;
		},
		setFocused: (field: LoginField, focused: boolean) => {
			setFocusedField((current) => (focused ? field : current === field ? null : current));
		},
		focus,
		dismissKeyboard: () => focus(null),
		showServerSetup: () => {
			focus(null);
			setShowSetup(true);
		},
		cancelServerSetup: () => {
			focus(null);
			assignFields({ serverURL: manager.serverURL });
			setShowSetup(false);
		},
		revealPasswordForm: () => {
			if (!useClientManager.getState().isLocalAuthAvailable()) return;
			focus(null);
			setShowsPasswordForm(true);
			setTimeout(() => {
				const { username: u, password: p } = latest.current;
				focus(!u ? 'username' : !p ? 'password' : null);
			}, 200);
		},
		dismissDemoExpiredMessage: manager.dismissDemoExpiredMessage,
		openConnectionProfiles: () => {
			focus(null);
			useConnectionProfileSelection.getState().begin(connect);
			router.push({
				pathname: '/connection-profiles',
				params: { select: '1', suggested: serverURL }
			} as never);
		},
		connectToServer,
		signIn,
		signInWithOIDC: () => {
			focus(null);
			pendingPasswordCredentialChange.current = undefined;
			void manager.loginWithOIDC();
		},
		signInWithPasskey: () => {
			focus(null);
			pendingPasswordCredentialChange.current = undefined;
			void manager.loginWithPasskey();
		},
		completeMFAWithPasskey: () =>
			void finishMFA(() => useClientManager.getState().completePendingMFAWithPasskey()),
		completeMFAWithRecoveryCode: () =>
			void finishMFA(() =>
				useClientManager.getState().completePendingMFAWithRecoveryCode(recoveryCode)
			),
		backToSignIn: () => {
			focus(null);
			assignFields({ recoveryCode: '' });
			pendingPasswordCredentialChange.current = undefined;
			manager.cancelPendingMFA();
		},
		startDemo: () => void manager.startDemo(),
		acceptSavedSignIn: () => {
			if (savedSignInOffer) useSavedSignIn(savedSignInOffer);
		},
		declineSavedSignIn: () => setSavedSignInOffer(undefined)
	};
}

export type LoginModel = ReturnType<typeof useLoginModel>;
