import { friendlyErrorMessage } from '@/core/errors';
import { isArcaneError } from '@/sdk/errors/ArcaneError';

export const minimumNewPasswordLength = 8;

export function requiresPasswordChangeGate(
	user: { requiresPasswordChange: boolean } | undefined,
	isDemo: boolean
): boolean {
	return !isDemo && user?.requiresPasswordChange === true;
}

export type PasswordChangeForm = {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
};

export type PasswordChangeValidation = {
	canSubmit: boolean;
	hint: string | undefined;
};

export function validatePasswordChangeForm(form: PasswordChangeForm): PasswordChangeValidation {
	const { currentPassword, newPassword, confirmPassword } = form;
	if (newPassword !== '' && newPassword.length < minimumNewPasswordLength) {
		return {
			canSubmit: false,
			hint: `New password must be at least ${minimumNewPasswordLength} characters.`
		};
	}
	if (confirmPassword !== '' && newPassword !== confirmPassword) {
		return { canSubmit: false, hint: "Passwords don't match." };
	}
	if (newPassword !== '' && currentPassword !== '' && newPassword === currentPassword) {
		return { canSubmit: false, hint: 'New password must differ from the current one.' };
	}
	return {
		canSubmit: currentPassword !== '' && newPassword !== '' && newPassword === confirmPassword,
		hint: undefined
	};
}

export function passwordChangeErrorMessage(error: unknown): string {
	if (isArcaneError(error, 'unauthorized')) return 'Current password is incorrect.';
	return friendlyErrorMessage(error);
}
