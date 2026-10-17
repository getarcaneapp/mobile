import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import {
	ConnectionProfileSync,
	SavedConnectionCredential,
	type ConnectionProfile
} from '@/core/connection-profiles/connection-profile-sync';
import { ConnectionProfileCopy } from '@/core/connection-profiles/connection-profile-copy';
import { useClientManager } from '@/stores/client-manager';
import { useConnectionProfileSelection } from '@/stores/connection-profile-selection';
import { syncStateDescription, useConnectionProfileStore } from '@/stores/connection-profile-store';
import { presentDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

export const connectionProfilesConfirmationHost =
	Platform.OS === 'ios' ? 'connection-profiles' : 'root';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useConnectionProfiles({ pushed = false }: { pushed?: boolean } = {}) {
	const router = useRouter();
	const confirmationHost = pushed ? undefined : connectionProfilesConfirmationHost;
	const params = useLocalSearchParams<{ select?: string; suggested?: string }>();
	const onSelect = useConnectionProfileSelection((s) => s.onSelect);
	const isSelecting = params.select === '1' && onSelect !== undefined;
	const suggestedServerURL = params.suggested ?? '';
	const profiles = useConnectionProfileStore((s) => s.profiles);
	const credentialIDs = useConnectionProfileStore((s) => s.credentialProfileIDs);
	const syncState = useConnectionProfileStore((s) => s.syncState);
	const serverURL = useClientManager((s) => s.serverURL);
	const isDemoActive = useClientManager((s) => s.isDemoActive);

	useEffect(() => () => useConnectionProfileSelection.getState().end(), []);

	const store = useConnectionProfileStore.getState();
	const currentProfileID = store.profile(serverURL)?.id;
	const isCurrent = (profile: ConnectionProfile) => currentProfileID === profile.id;
	const hasCredential = (profile: ConnectionProfile) => credentialIDs.has(profile.id);

	const canSaveCurrentServer = serverURL !== '' && !isDemoActive && currentProfileID === undefined;

	const editorSuggestion = suggestedServerURL.trim()
		? suggestedServerURL
		: isDemoActive
			? ''
			: serverURL;

	const openEditor = (profile?: ConnectionProfile) =>
		router.push({
			pathname: '/connection-profile-editor',
			params: { id: profile?.id ?? '', suggested: profile?.serverURL ?? editorSuggestion }
		} as never);

	const connect = (profile: ConnectionProfile) => {
		useClientManager.getState().configure(profile.serverURL);
		if (useClientManager.getState().errorMessage === undefined)
			showToast(Toasts.info(`Switched to ${profile.name}`));
	};

	const deleteMessage = (profile: ConnectionProfile) => {
		const item = hasCredential(profile) ? 'profile and its saved sign-in' : 'saved profile';
		return ConnectionProfileCopy.deleteMessage(item, isCurrent(profile));
	};

	return {
		copy: ConnectionProfileCopy,
		profiles,
		isSelecting,
		canSaveCurrentServer,
		syncStateDescription: syncStateDescription[syncState],
		isCurrent,
		hasCredential,
		accessibilityValue: (profile: ConnectionProfile) =>
			[
				isCurrent(profile) ? 'Current server' : undefined,
				hasCredential(profile) ? ConnectionProfileCopy.credentialBadge : undefined
			]
				.filter(Boolean)
				.join(', '),
		done: () => router.back(),
		addProfile: () => openEditor(),
		editProfile: (profile: ConnectionProfile) => openEditor(profile),
		select: (profile: ConnectionProfile) => {
			if (isSelecting && onSelect) {
				onSelect(profile);
				router.back();
			} else if (!isCurrent(profile)) {
				presentDeleteConfirmation(
					{
						title: `Switch to ${profile.name}?`,
						message:
							"You'll be signed out of the current server. Its saved profile will remain available.",
						icon: 'arrow.left.arrow.right',
						actions: [{ title: 'Switch Server', action: () => connect(profile) }],
						dismissOnConfirm: false
					},
					{ hostID: confirmationHost }
				);
			}
		},
		confirmDelete: (profile: ConnectionProfile) =>
			presentDeleteConfirmation(
				{
					title: `Delete ${profile.name}?`,
					message: deleteMessage(profile),
					icon: 'trash',
					actions: [
						{
							title: 'Delete Profile',
							action: () => {
								try {
									useConnectionProfileStore.getState().delete(profile);
									showToast(Toasts.success('Connection profile deleted'));
								} catch (error) {
									showToast(Toasts.error(errorText(error)));
								}
							}
						}
					],
					dismissOnConfirm: false
				},
				{ hostID: confirmationHost }
			),
		saveCurrentServer: () => {
			try {
				useConnectionProfileStore
					.getState()
					.saveConnectedServer(useClientManager.getState().serverURL);
				showToast(Toasts.success('Connection profile saved'));
			} catch (error) {
				showToast(Toasts.error(errorText(error)));
			}
		}
	};
}

export type ConnectionProfilesModel = ReturnType<typeof useConnectionProfiles>;

type CredentialLoadState = 'loading' | 'ready' | 'failed';

export function useConnectionProfileEditor() {
	const router = useRouter();
	const params = useLocalSearchParams<{ id?: string; suggested?: string }>();
	const [profile] = useState<ConnectionProfile | undefined>(() =>
		params.id
			? useConnectionProfileStore.getState().profiles.find((p) => p.id === params.id)
			: undefined
	);
	const [name, setNameState] = useState(profile?.name ?? '');
	const [serverURL, setServerURLState] = useState(profile?.serverURL ?? params.suggested ?? '');
	const [username, setUsernameState] = useState('');
	const [password, setPasswordState] = useState('');
	const [credentialLoadState, setCredentialLoadState] = useState<CredentialLoadState>(
		profile ? 'loading' : 'ready'
	);
	const [hasExistingCredential, setHasExistingCredential] = useState(false);
	const [signInNotice, setSignInNotice] = useState<string>();
	const [validationMessage, setValidationMessage] = useState<string>();
	const [fieldsRevision, setFieldsRevision] = useState(0);

	const loadCredential = () => {
		if (!profile) {
			setCredentialLoadState('ready');
			return;
		}
		setCredentialLoadState('loading');
		setValidationMessage(undefined);
		try {
			const credential = useConnectionProfileStore.getState().savedCredential(profile);
			let draftURL: string | undefined;
			try {
				draftURL = ConnectionProfileSync.normalizedServerURL(serverURL);
			} catch {
				draftURL = undefined;
			}
			if (credential && draftURL === profile.serverURL) {
				setUsernameState(credential.username);
				setPasswordState(credential.password);
				setFieldsRevision((r) => r + 1);
				setHasExistingCredential(true);
			} else if (credential) {
				setSignInNotice('Re-enter the sign-in after changing the server address.');
			}
			setCredentialLoadState('ready');
		} catch (error) {
			setCredentialLoadState('failed');
			setValidationMessage(errorText(error));
		}
	};

	useEffect(loadCredential, []); // eslint-disable-line react-hooks/exhaustive-deps

	const clearCredential = (notice: string) => {
		setUsernameState('');
		setPasswordState('');
		setFieldsRevision((r) => r + 1);
		setHasExistingCredential(false);
		setSignInNotice(notice);
	};

	const save = () => {
		if (credentialLoadState !== 'ready') return;
		try {
			const credential = SavedConnectionCredential.optional(username, password);
			useConnectionProfileStore
				.getState()
				.saveConnectionProfile(profile, name, serverURL, credential);
			showToast(
				Toasts.success(profile ? 'Connection profile updated' : 'Connection profile added')
			);
			router.back();
		} catch (error) {
			setValidationMessage(errorText(error));
		}
	};

	return {
		copy: ConnectionProfileCopy,
		isNew: profile === undefined,
		title: profile ? 'Edit Profile' : 'New Profile',
		name,
		serverURL,
		username,
		password,
		fieldsRevision,
		credentialLoadState,
		hasExistingCredential,
		signInNotice,
		validationMessage,
		initialFocus: (profile === undefined && !serverURL ? 'serverURL' : 'name') as
			| 'serverURL'
			| 'name',
		canSave: serverURL.trim() !== '' && credentialLoadState === 'ready',
		setName: (value: string) => {
			setNameState(value);
			setValidationMessage(undefined);
		},
		setServerURL: (value: string) => {
			setServerURLState(value);
			setValidationMessage(undefined);
			if (!profile || !hasExistingCredential) return;
			try {
				if (ConnectionProfileSync.normalizedServerURL(value) === profile.serverURL) return;
			} catch {
				return;
			}
			clearCredential('Re-enter the sign-in after changing the server address.');
		},
		setUsername: (value: string) => {
			setUsernameState(value);
			setValidationMessage(undefined);
		},
		setPassword: (value: string) => {
			setPasswordState(value);
			setValidationMessage(undefined);
		},
		removeSavedSignIn: () => clearCredential('The saved sign-in will be removed when you save.'),
		loadCredential,
		save,
		cancel: () => router.back()
	};
}

export type ConnectionProfileEditorModel = ReturnType<typeof useConnectionProfileEditor>;
