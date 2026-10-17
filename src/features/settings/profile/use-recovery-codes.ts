/**
 * Shared logic for `RecoveryCodesSaveView` (PasskeysMFAView.swift): the
 * one-time list of MFA recovery codes, presented as a non-dismissable sheet.
 */
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads } from '../shared/settings-routes';
import type { RecoveryCodesPayload } from './use-passkeys-mfa';

export function useRecoveryCodes() {
	const router = useRouter();
	const { payload: token } = useLocalSearchParams<{ payload?: string }>();
	// Read once: the payload is released as soon as the user confirms.
	const [codes] = useState(() => settingsPayloads.get<RecoveryCodesPayload>(token)?.codes ?? []);

	return {
		codes,
		copyAll: () => {
			void Clipboard.setStringAsync(codes.join('\n'));
			showToast(Toasts.copied('Recovery codes copied'));
		},
		confirmSaved: () => {
			settingsPayloads.delete(token);
			if (router.canGoBack()) router.back();
		}
	};
}
