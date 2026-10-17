/** Route screen for `NewWebhookTokenView` (WebhooksView.swift): the one-time webhook token reveal. */
import { useLocalSearchParams, useRouter } from 'expo-router';

import { systemColors } from '@/theme/colors';

import { SecretRevealScreen } from '../shared/secret-reveal';
import { settingsPayloads } from '../shared/settings-routes';
import type { WebhookTokenPayload } from './webhook-models';

export function WebhookTokenScreen() {
	const router = useRouter();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const created = settingsPayloads.get<WebhookTokenPayload>(token);
	if (!created) return null;
	return (
		<SecretRevealScreen
			navigationTitle="Webhook Created"
			systemImage="link.badge.plus"
			iconColor={systemColors.green}
			heading="Save Your Webhook Token"
			message="This token will only be shown once. Make sure to save it somewhere safe."
			secret={created.token}
			secretCaption={created.name}
			copiedToast="Webhook token copied"
			onDone={() => {
				if (router.canGoBack()) router.back();
			}}
		/>
	);
}
