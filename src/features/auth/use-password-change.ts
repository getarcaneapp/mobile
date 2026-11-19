import { useState } from 'react';

import {
	minimumNewPasswordLength,
	passwordChangeErrorMessage,
	validatePasswordChangeForm
} from '@/core/auth/password-change';
import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

async function continueIntoApp(): Promise<string | undefined> {
	try {
		await useClientManager.getState().completePasswordChange();
		return undefined;
	} catch (error) {
		return friendlyErrorMessage(error);
	}
}

async function changePassword(currentPassword: string, newPassword: string) {
	const client = useClientManager.getState().client;
	if (!client) return 'No server configured';
	try {
		await client.auth.changePassword({ currentPassword, newPassword });
		return undefined;
	} catch (error) {
		return passwordChangeErrorMessage(error);
	}
}

export function usePasswordChange() {
	const username = useClientManager((s) => s.currentUser?.username);
	const isSigningOut = useClientManager((s) => s.isLoading);
	const signOutError = useClientManager((s) => s.errorMessage);

	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [passwordChanged, setPasswordChanged] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const validation = validatePasswordChangeForm({ currentPassword, newPassword, confirmPassword });
	const canSubmit = !isSaving && !isSigningOut && (passwordChanged || validation.canSubmit);

	const submit = async () => {
		if (!canSubmit) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				if (!passwordChanged) {
					const failure = await changePassword(currentPassword, newPassword);
					if (failure !== undefined) {
						setErrorMessage(failure);
						return;
					}
					setPasswordChanged(true);
					setCurrentPassword('');
					setNewPassword('');
					setConfirmPassword('');
					showToast(Toasts.success('Password changed'));
				}
				const failure = await continueIntoApp();
				if (failure !== undefined) setErrorMessage(failure);
			},
			() => setIsSaving(false)
		);
	};

	const signOut = () => {
		if (isSaving) return;
		void useClientManager.getState().logout();
	};

	return {
		username,
		currentPassword,
		setCurrentPassword,
		newPassword,
		setNewPassword,
		confirmPassword,
		setConfirmPassword,
		newPasswordPlaceholder: `At least ${minimumNewPasswordLength} characters`,
		hint: validation.hint,
		errorMessage: errorMessage ?? signOutError,
		isSaving,
		isSigningOut,
		passwordChanged,
		canSubmit,
		submitTitle: passwordChanged ? 'Continue' : 'Change Password',
		submit: () => void submit(),
		signOut
	};
}

export type PasswordChangeModel = ReturnType<typeof usePasswordChange>;
