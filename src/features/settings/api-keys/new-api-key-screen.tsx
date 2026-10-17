/** Route screen for `NewAPIKeyView` (CreateAPIKeyView.swift): the one-time API key reveal. */
import { useLocalSearchParams, useRouter } from 'expo-router';

import { systemColors } from '@/theme/colors';

import { SecretRevealScreen } from '../shared/secret-reveal';
import { settingsPayloads } from '../shared/settings-routes';
import type { APIKeySecretPayload } from './api-key-models';

export function NewAPIKeyScreen() {
	const router = useRouter();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const presentation = settingsPayloads.get<APIKeySecretPayload>(token)?.presentation;
	const done = () => {
		if (router.canGoBack()) router.back();
	};
	if (!presentation) return null;
	return (
		<SecretRevealScreen
			navigationTitle={presentation.navigationTitle}
			systemImage="key.fill"
			iconColor={systemColors.yellow}
			heading={presentation.heading}
			message={presentation.message}
			secret={presentation.key}
			fullWidthSecret
			warning={presentation.warning}
			copiedToast="API key copied"
			onDone={done}
		/>
	);
}
