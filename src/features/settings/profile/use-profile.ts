/**
 * Shared state and logic for `ProfileView` (Views/Settings/ProfileView.swift):
 * editable display name + email, password change, sign-out flavors, and the
 * single Save that applies whatever changed.
 */
import { useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { useSettingsNavigation } from '../shared/settings-routes';

/** Which sign-out flavor is awaiting confirmation. */
export type PendingSignOut = 'signOut' | 'signOutAndChangeServer';

export const minimumPasswordLength = 8;

export function useProfile() {
	const user = useClientManager((s) => s.currentUser);
	const supportsPost26MobileFeatures = useClientManager((s) => s.supportsPost26MobileFeatures);
	const navigation = useSettingsNavigation();

	const [displayName, setDisplayName] = useState('');
	const [email, setEmail] = useState('');
	const [hasSeededFields, setHasSeededFields] = useState(false);

	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');

	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [pendingSignOut, setPendingSignOut] = useState<PendingSignOut>();

	const isOIDCUser = !!user?.oidcSubjectId;

	// SSO profiles are owned by the identity provider — name and email are
	// read-only, matching the web UI.
	const profileChanged =
		!!user &&
		!isOIDCUser &&
		(displayName.trim() !== (user.displayName ?? '') || email.trim() !== (user.email ?? ''));
	const wantsPasswordChange =
		currentPassword !== '' || newPassword !== '' || confirmPassword !== '';
	const passwordValid =
		currentPassword !== '' &&
		newPassword.length >= minimumPasswordLength &&
		newPassword === confirmPassword;
	const canSave = profileChanged || (wantsPasswordChange && passwordValid);
	const hasChanges = profileChanged || wantsPasswordChange;

	// `.onAppear { seedFields() }`
	useEffect(() => {
		if (hasSeededFields || !user) return;
		setHasSeededFields(true);
		setDisplayName(user.displayName ?? '');
		setEmail(user.email ?? '');
	}, [hasSeededFields, user]);

	const passwordFooter =
		newPassword !== '' && newPassword.length < minimumPasswordLength
			? 'New password must be at least 8 characters.'
			: confirmPassword !== '' && newPassword !== confirmPassword
				? "Passwords don't match."
				: 'Leave blank to keep your current password.';

	const revertChanges = () => {
		setDisplayName(user?.displayName ?? '');
		setEmail(user?.email ?? '');
		setCurrentPassword('');
		setNewPassword('');
		setConfirmPassword('');
		setErrorMessage(undefined);
	};

	/** One Save applies whatever changed: profile fields, password, or both. */
	const save = async () => {
		const { client, currentUser } = useClientManager.getState();
		if (!client || !currentUser) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		try {
			let savedSomething = false;
			if (profileChanged) {
				const updated = await client.users.update({
					id: currentUser.id,
					body: { displayName: displayName.trim(), email: email.trim() }
				});
				useClientManager.setState({ currentUser: updated });
				savedSomething = true;
			}
			if (wantsPasswordChange && passwordValid) {
				await client.users.changePassword({ body: { currentPassword, newPassword } });
				setCurrentPassword('');
				setNewPassword('');
				setConfirmPassword('');
				savedSomething = true;
			}
			if (savedSomething) showToast(Toasts.success('Account updated'));
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	useItemDeleteConfirmation(pendingSignOut, setPendingSignOut, (action) =>
		action === 'signOut'
			? {
					title: 'Sign Out',
					message: "You'll be signed out of this server.",
					icon: 'rectangle.portrait.and.arrow.right',
					actions: [{ title: 'Sign Out', action: () => void useClientManager.getState().logout() }]
				}
			: {
					title: 'Change Server',
					message: "You'll be signed out and asked for a new server URL.",
					icon: 'link',
					actions: [
						{
							title: 'Sign Out & Change Server',
							action: () =>
								void (async () => {
									await useClientManager.getState().logout();
									useClientManager.setState({ authState: 'setup' });
								})()
						}
					]
				}
	);

	return {
		user,
		isOIDCUser,
		isAdmin: user ? User.isAdmin(user) : false,
		/** `displayName` when set, else the username. */
		headline: user?.displayName ? user.displayName : (user?.username ?? '—'),
		handle: `@${user?.username ?? '—'}`,
		readOnlyDisplayName: user?.displayName ? user.displayName : '—',
		readOnlyEmail: user?.email ? user.email : '—',
		showsPreferences: user?.preferences !== undefined,
		showsSecurity: supportsPost26MobileFeatures,

		displayName,
		setDisplayName,
		email,
		setEmail,
		currentPassword,
		setCurrentPassword,
		newPassword,
		setNewPassword,
		confirmPassword,
		setConfirmPassword,
		passwordFooter,

		isSaving,
		errorMessage,
		canSave,
		hasChanges,
		save: () => void save(),
		revertChanges,

		requestSignOut: setPendingSignOut,

		openPreferences: () => navigation.push('settings/profile/preferences'),
		openPasskeys: () => navigation.push('settings/profile/passkeys'),
		openConnectionProfiles: () => navigation.push('settings/profile/connection-profiles')
	};
}

export type ProfileModel = ReturnType<typeof useProfile>;
