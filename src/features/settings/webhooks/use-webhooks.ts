import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { UpdateWebhook, Webhook } from '@/sdk/models/webhook/Webhook';
import { parseArcaneDate } from '@/sdk/models/base/date';
import { useClientManager } from '@/stores/client-manager';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';
import type { CreateWebhookPayload, WebhookTokenPayload } from './webhook-models';

export function webhookIcon(targetType: string): string {
	switch (targetType) {
		case 'container':
			return 'shippingbox';
		case 'project':
			return 'folder';
		case 'updater':
			return 'arrow.triangle.2.circlepath';
		case 'gitops':
			return 'arrow.triangle.branch';
		default:
			return 'link';
	}
}

export function capitalized(value: string): string {
	return value.replace(
		/\w\S*/g,
		(word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
	);
}

export function relativeStyle(value: string): string | undefined {
	const date = parseArcaneDate(value);
	if (!date) return undefined;
	let seconds = Math.max(0, Math.floor(Math.abs(Date.now() - date.getTime()) / 1000));
	const units: [number, string][] = [
		[86400 * 365, 'yr'],
		[86400 * 30, 'mo'],
		[86400 * 7, 'wk'],
		[86400, 'day'],
		[3600, 'hr'],
		[60, 'min'],
		[1, 'sec']
	];
	const parts: string[] = [];
	for (const [size, unit] of units) {
		if (parts.length === 2) break;
		const count = Math.floor(seconds / size);
		if (count === 0 && parts.length === 0) continue;
		if (count === 0) break;
		seconds -= count * size;
		parts.push(`${count} ${unit}${unit === 'day' && count !== 1 ? 's' : ''}`);
	}
	return parts.length === 0 ? '0 sec' : parts.join(', ');
}

function presentError(message: string) {
	Alert.alert('Error', message, [{ text: 'OK' }]);
}

export function useWebhooks() {
	const navigation = useSettingsNavigation();
	const client = useClientManager((s) => s.client);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const [webhooks, setWebhooks] = useState<Webhook[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<Webhook>();
	const webhooksRef = useRef(webhooks);
	useLayoutEffect(() => {
		webhooksRef.current = webhooks;
	});

	const loadWebhooks = useCallback(async () => {
		const manager = useClientManager.getState();
		const cached = cachedClient();
		if (!manager.client || !cached) return;
		if (webhooksRef.current.length === 0) setIsLoading(true);
		const client = manager.client;
		await withCleanup(
			async () => {
				try {
					const envID = manager.activeEnvironmentID;
					const path = client.rest.environmentPath(envID, 'webhooks');
					setWebhooks(await cached.getList<Webhook>(path, envID));
				} catch (error) {
					presentError(friendlyErrorMessage(error));
				}
			},
			() => setIsLoading(false)
		);
	}, []);

	useEffect(() => {
		void loadWebhooks();
	}, [loadWebhooks, client, activeEnvironmentID]);

	const invalidateWebhookCaches = () => {
		const manager = useClientManager.getState();
		const cached = cachedClient();
		if (!cached || !manager.client) return;
		const envID = manager.activeEnvironmentID;
		cached.invalidate(envID, [manager.client.rest.environmentPath(envID, 'webhooks') + '*']);
	};

	const deleteWebhook = async (webhook: Webhook) => {
		const manager = useClientManager.getState();
		if (!manager.client) return;
		try {
			await manager.client.webhooks.delete({ id: webhook.id, envID: manager.activeEnvironmentID });
			setWebhooks((current) => current.filter((item) => item.id !== webhook.id));
			invalidateWebhookCaches();
			showToast(Toasts.success('Webhook deleted'));
		} catch (error) {
			presentError(friendlyErrorMessage(error));
		}
	};

	const toggleWebhook = async (webhook: Webhook) => {
		const manager = useClientManager.getState();
		if (!manager.client) return;
		const successMessage = webhook.enabled ? 'Webhook disabled' : 'Webhook enabled';
		try {
			const body: UpdateWebhook = { enabled: !webhook.enabled };
			const path = manager.client.rest.environmentPath(
				manager.activeEnvironmentID,
				`webhooks/${webhook.id}`
			);
			await manager.client.transport.rawRequest(path, { method: 'PATCH', body });
			invalidateWebhookCaches();
			await loadWebhooks();
			showToast(Toasts.success(successMessage));
		} catch (error) {
			presentError(friendlyErrorMessage(error));
		}
	};

	useItemDeleteConfirmation(pendingDelete, setPendingDelete, (webhook) => ({
		title: 'Delete Webhook',
		message: `Delete “${webhook.name}”? This cannot be undone.`,
		icon: 'trash',
		actions: [{ title: 'Delete', action: () => void deleteWebhook(webhook) }]
	}));

	const pendingToken = useRef<WebhookTokenPayload | undefined>(undefined);
	const isFocused = useRef(false);
	const presentPendingToken = useCallback(() => {
		const token = pendingToken.current;
		if (!token || !isFocused.current) return;
		pendingToken.current = undefined;
		navigation.push('settings/webhooks/token', { token: settingsPayloads.put(token) });
	}, [navigation]);
	useFocusEffect(
		useCallback(() => {
			isFocused.current = true;
			const timer = setTimeout(presentPendingToken, 350);
			return () => {
				isFocused.current = false;
				clearTimeout(timer);
			};
		}, [presentPendingToken])
	);

	const showCreateSheet = () => {
		const payload: CreateWebhookPayload = {
			onCreated: (created) => {
				pendingToken.current = { name: created.name, token: created.token };
				presentPendingToken();
				void loadWebhooks();
			}
		};
		navigation.push('settings/webhooks/create', { token: settingsPayloads.put(payload) });
	};

	return {
		webhooks,
		isLoading,
		loadWebhooks,
		showCreateSheet,
		toggleWebhook: (webhook: Webhook) => void toggleWebhook(webhook),
		requestDelete: setPendingDelete
	};
}

export type WebhooksModel = ReturnType<typeof useWebhooks>;
