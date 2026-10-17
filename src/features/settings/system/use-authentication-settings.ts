/**
 * Data flow of `AuthenticationSettingsView` (AuthenticationSettingsView.swift):
 * local auth + OIDC provider settings, loaded from and saved to the active
 * environment's flat settings, with the OIDC env-var override status.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { useCachedClient } from '@/core/networking/use-cached-client';
import type { PublicSetting } from '@/sdk/models/settings/Settings';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { swiftInt } from '@/ui/components/settings-form.types';

/** Port of `AuthenticationSettingsValidation`. */
export const AuthenticationSettingsValidation = {
	sessionTimeoutMinutes: { lowerBound: 15, upperBound: 525_600 },

	sessionTimeoutError(rawValue: string): string | undefined {
		const minutes = swiftInt(rawValue.trim());
		const { lowerBound, upperBound } = AuthenticationSettingsValidation.sessionTimeoutMinutes;
		if (minutes === undefined || minutes < lowerBound || minutes > upperBound) {
			return 'Session Timeout must be a whole number between 15 and 525600 minutes.';
		}
		return undefined;
	}
} as const;

/** The Password Policy picker's options (label, raw value). */
export const passwordPolicyOptions = [
	{ label: 'Basic', value: 'basic' },
	{ label: 'Standard', value: 'standard' },
	{ label: 'Strong', value: 'strong' }
];

export type AuthenticationForm = {
	// Local Auth
	authLocalEnabled: boolean;
	authSessionTimeout: string;
	authPasswordPolicy: string;
	// OIDC
	oidcEnabled: boolean;
	oidcProviderName: string;
	oidcIssuerUrl: string;
	oidcClientId: string;
	oidcClientSecret: string;
	oidcScopes: string;
	oidcGroupsClaim: string;
	oidcSkipTlsVerify: boolean;
	oidcAutoRedirectToProvider: boolean;
	oidcMergeAccounts: boolean;
	oidcProviderLogoUrl: string;
};

const initialForm: AuthenticationForm = {
	authLocalEnabled: true,
	authSessionTimeout: '1440',
	authPasswordPolicy: 'strong',
	oidcEnabled: false,
	oidcProviderName: '',
	oidcIssuerUrl: '',
	oidcClientId: '',
	oidcClientSecret: '',
	oidcScopes: 'openid email profile',
	oidcGroupsClaim: '',
	oidcSkipTlsVerify: false,
	oidcAutoRedirectToProvider: false,
	oidcMergeAccounts: false,
	oidcProviderLogoUrl: ''
};

/** Builds the form from the loaded settings with the same fallbacks as `loadSettings()`. */
function formFromSettings(dict: Record<string, string>): AuthenticationForm {
	const isTrue = (key: string) => dict[key]?.toLowerCase() === 'true';
	return {
		authLocalEnabled: isTrue('authLocalEnabled'),
		authSessionTimeout: dict.authSessionTimeout ?? '1440',
		authPasswordPolicy: dict.authPasswordPolicy ?? 'strong',
		oidcEnabled: isTrue('oidcEnabled'),
		oidcProviderName: dict.oidcProviderName ?? '',
		oidcIssuerUrl: dict.oidcIssuerUrl ?? '',
		oidcClientId: dict.oidcClientId ?? '',
		oidcClientSecret: dict.oidcClientSecret ?? '',
		oidcScopes: dict.oidcScopes ?? 'openid email profile',
		oidcGroupsClaim: dict.oidcGroupsClaim ?? '',
		oidcSkipTlsVerify: isTrue('oidcSkipTlsVerify'),
		oidcAutoRedirectToProvider: isTrue('oidcAutoRedirectToProvider'),
		oidcMergeAccounts: isTrue('oidcMergeAccounts'),
		oidcProviderLogoUrl: dict.oidcProviderLogoUrl ?? ''
	};
}

const formKeys = Object.keys(initialForm) as (keyof AuthenticationForm)[];
const sameForm = (lhs: AuthenticationForm, rhs: AuthenticationForm) =>
	formKeys.every((key) => lhs[key] === rhs[key]);

export function useAuthenticationSettings() {
	const client = useClientManager((s) => s.client);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const cached = useCachedClient();

	const [form, setForm] = useState<AuthenticationForm>(initialForm);
	const [originalState, setOriginalState] = useState<AuthenticationForm>();
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	// Env-var override status
	const [oidcEnvForced, setOidcEnvForced] = useState(false);

	const latestForm = useRef(form);
	latestForm.current = form;

	const hasChanges = !isLoading && originalState !== undefined && !sameForm(form, originalState);

	const update = useCallback(
		<Key extends keyof AuthenticationForm>(key: Key, value: AuthenticationForm[Key]) => {
			setForm((current) => ({ ...current, [key]: value }));
		},
		[]
	);

	const loadSettings = useCallback(async () => {
		if (!client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		setOriginalState(undefined);
		try {
			const path = client.rest.environmentPath(activeEnvironmentID, 'settings');
			const text = await client.transport.rawRequest(path);
			const dtos = client.transport.decode<PublicSetting[]>(text);
			const dict: Record<string, string> = {};
			for (const dto of dtos) dict[dto.key] = dto.value;
			const loaded = formFromSettings(dict);
			setForm(loaded);
			try {
				const status = await client.auth.oidcStatus();
				setOidcEnvForced(status.envForced);
			} catch {
				// Silently ignore — fields remain editable if status check fails
			}
			setOriginalState(loaded);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsLoading(false);
		}
	}, [client, activeEnvironmentID]);

	useEffect(() => {
		void loadSettings();
	}, [loadSettings]);

	const revertChanges = useCallback(() => {
		if (!originalState) return;
		setForm(originalState);
		setErrorMessage(undefined);
	}, [originalState]);

	const save = useCallback(async () => {
		if (!client) return;
		const current = latestForm.current;
		const validationError = AuthenticationSettingsValidation.sessionTimeoutError(
			current.authSessionTimeout
		);
		if (validationError) {
			setErrorMessage(validationError);
			showToast(Toasts.error(validationError));
			return;
		}

		setIsSaving(true);
		setErrorMessage(undefined);
		try {
			// Settings are flat string key/values server-side; send a raw dict so we can
			// include keys (e.g. oidcGroupsClaim) the SDK's UpdateSettings doesn't model.
			const body: Record<string, string> = {
				authLocalEnabled: String(current.authLocalEnabled),
				authPasswordPolicy: current.authPasswordPolicy,
				authSessionTimeout: current.authSessionTimeout,
				oidcEnabled: String(current.oidcEnabled),
				oidcMergeAccounts: String(current.oidcMergeAccounts),
				oidcSkipTlsVerify: String(current.oidcSkipTlsVerify),
				oidcAutoRedirectToProvider: String(current.oidcAutoRedirectToProvider)
			};
			// Omit empty optional fields so they don't overwrite existing server values.
			const setIfPresent = (key: keyof AuthenticationForm) => {
				const trimmed = String(current[key]).trim();
				if (trimmed !== '') body[key] = trimmed;
			};
			setIfPresent('oidcClientId');
			setIfPresent('oidcClientSecret');
			setIfPresent('oidcIssuerUrl');
			setIfPresent('oidcScopes');
			setIfPresent('oidcGroupsClaim');
			setIfPresent('oidcProviderName');
			setIfPresent('oidcProviderLogoUrl');

			const path = client.rest.environmentPath(activeEnvironmentID, 'settings');
			await client.rest.put<PublicSetting[]>(path, { body });
			cached?.invalidate(activeEnvironmentID, [path, `${path}*`]);
			setOriginalState(latestForm.current);
			showToast(Toasts.success('Authentication settings saved'));
		} catch (error) {
			const message = friendlyErrorMessage(error);
			setErrorMessage(message);
			showToast(Toasts.error(message));
		} finally {
			setIsSaving(false);
		}
	}, [client, activeEnvironmentID, cached]);

	return {
		form,
		update,
		isLoading,
		isSaving,
		errorMessage,
		oidcEnvForced,
		hasChanges,
		save,
		revertChanges
	};
}
