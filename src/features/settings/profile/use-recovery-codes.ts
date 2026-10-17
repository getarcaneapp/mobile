import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads } from '../shared/settings-routes';
import type { RecoveryCodesPayload } from './use-passkeys-mfa';

export function useRecoveryCodes() {
	const router = useRouter();
	const { payload: token } = useLocalSearchParams<{ payload?: string }>();
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
