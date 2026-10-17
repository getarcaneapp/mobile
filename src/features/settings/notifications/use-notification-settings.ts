/**
 * Data flow of `NotificationSettingsView` (NotificationSettingsView.swift):
 * the configured providers for the active environment, deleting a provider,
 * and opening a provider's form.
 */
import { useCallback, useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import {
	NotificationSettings,
	type NotificationProvider
} from '@/sdk/models/notification/Notification';
import { useClientManager } from '@/stores/client-manager';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';
import { notificationProviders, providerDisplayName } from './notification-provider-models';

/** Route of the pushed provider form. */
export const notificationProviderRoute = 'settings/notifications/provider';

/** Hand-off for the pushed `NotificationProviderFormView`. */
export type NotificationProviderFormPayload = {
	provider: NotificationProvider;
	existing: NotificationSettings | undefined;
	onSaved: () => Promise<void>;
};

export function useNotificationSettings() {
	const client = useClientManager((s) => s.client);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const supportsPost26Features = useClientManager((s) => s.supportsPost26MobileFeatures);
	const navigation = useSettingsNavigation();

	const [configuredProviders, setConfiguredProviders] = useState<NotificationSettings[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [pendingDeleteProvider, setPendingDeleteProvider] = useState<NotificationProvider>();

	const availableProviders = notificationProviders(supportsPost26Features);
	const configuredResponse = (provider: NotificationProvider) =>
		configuredProviders.find((settings) => NotificationSettings.provider(settings) === provider);

	const loadProviders = useCallback(async () => {
		if (!client) return;
		setIsLoading(true);
		try {
			setConfiguredProviders(
				await client.notifications.listSettings({ envID: activeEnvironmentID })
			);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsLoading(false);
		}
	}, [client, activeEnvironmentID]);

	useEffect(() => {
		void loadProviders();
	}, [loadProviders]);

	const deleteProvider = useCallback(
		async (provider: NotificationProvider) => {
			if (!client) return;
			try {
				await client.notifications.deleteSettings({
					provider,
					envID: activeEnvironmentID
				});
				setConfiguredProviders((current) =>
					current.filter((settings) => NotificationSettings.provider(settings) !== provider)
				);
				showToast(Toasts.success('Notification provider deleted'));
			} catch (error) {
				setErrorMessage(friendlyErrorMessage(error));
			}
		},
		[client, activeEnvironmentID]
	);

	useItemDeleteConfirmation(pendingDeleteProvider, setPendingDeleteProvider, (provider) => ({
		title: 'Delete Provider',
		message: `Remove the “${providerDisplayName[provider]}” notification provider? You'll stop receiving its notifications.`,
		icon: 'trash',
		actions: [{ title: 'Delete', action: () => void deleteProvider(provider) }]
	}));

	const openProvider = (provider: NotificationProvider) => {
		const payload: NotificationProviderFormPayload = {
			provider,
			existing: configuredResponse(provider),
			onSaved: loadProviders
		};
		navigation.push(notificationProviderRoute, {
			provider,
			payload: settingsPayloads.put(payload)
		});
	};

	return {
		availableProviders,
		configuredResponse,
		hasConfiguredProviders: configuredProviders.length > 0,
		isLoading,
		errorMessage,
		dismissError: () => setErrorMessage(undefined),
		loadProviders,
		requestDelete: setPendingDeleteProvider,
		openProvider
	};
}
