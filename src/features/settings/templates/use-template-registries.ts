import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { withCleanup } from '@/core/with-cleanup';
import { friendlyErrorMessage } from '@/core/errors';
import {
	boundedAPIResponse,
	RemoteDataLimitError,
	RemoteDataLimits
} from '@/core/networking/remote-data-limits';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { TemplateRegistry } from '@/sdk/models/template/Template';
import { useClientManager } from '@/stores/client-manager';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { useTemplatePermissions } from './template-permissions';
import { useTemplateNavigation } from './template-routes';

export const communityRegistryURL = 'https://registry.getarcane.app/registry.json';

export const templateRegistryCachePaths = [
	'templates/registries',
	'templates/registries/*',
	'templates/all'
];

function invalidateTemplateRegistryCache() {
	cachedClient()?.invalidateGlobal(templateRegistryCachePaths);
}

async function fetchTemplateRegistries(client: ArcaneClient): Promise<TemplateRegistry[]> {
	const loaded = await boundedAPIResponse<TemplateRegistry[]>(client, 'templates/registries', {
		maximumBytes: RemoteDataLimits.maximumTemplateBytes
	});
	if (loaded.length > RemoteDataLimits.maximumTemplateRegistries) {
		throw RemoteDataLimitError.collectionTooLarge(RemoteDataLimits.maximumTemplateRegistries);
	}
	return loaded;
}

export function useTemplateRegistries() {
	const client = useClientManager((s) => s.client);
	const permissions = useTemplatePermissions();
	const navigation = useTemplateNavigation();
	const canViewRegistries = permissions.canList;
	const canCreateRegistries = permissions.canCreate;
	const canUpdateRegistries = permissions.canUpdate;
	const canDeleteRegistries = permissions.canDelete;

	const [registries, setRegistries] = useState<TemplateRegistry[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [pendingDeleteRegistry, setPendingDeleteRegistry] = useState<TemplateRegistry>();
	const [isAddingCommunity, setIsAddingCommunity] = useState(false);
	const registriesRef = useRef(registries);
	useLayoutEffect(() => {
		registriesRef.current = registries;
	});

	const hasCommunityRegistry = registries.some(
		(registry) => registry.url.toLowerCase() === communityRegistryURL.toLowerCase()
	);

	const loadRegistries = useCallback(
		async (refresh = false) => {
			if (!canViewRegistries || !client) return;
			if (registriesRef.current.length === 0) setIsLoading(true);
			if (refresh) setErrorMessage(undefined);
			await withCleanup(
				async () => {
					try {
						const loaded = await fetchTemplateRegistries(client);
						setRegistries(loaded);
						setErrorMessage(undefined);
					} catch (error) {
						setErrorMessage(friendlyErrorMessage(error));
					}
				},
				() => setIsLoading(false)
			);
		},
		[canViewRegistries, client]
	);

	useEffect(() => {
		void loadRegistries();
	}, [loadRegistries]);

	const afterSave = useCallback(async () => {
		invalidateTemplateRegistryCache();
		await loadRegistries(true);
	}, [loadRegistries]);

	const addCommunityRegistry = async () => {
		if (!canCreateRegistries || !client) return;
		setIsAddingCommunity(true);
		await withCleanup(
			async () => {
				try {
					await client.templates.createRegistry({
						body: {
							name: 'Arcane Community Templates',
							url: communityRegistryURL,
							description: 'Official Arcane community template registry',
							enabled: true
						}
					});
					invalidateTemplateRegistryCache();
					await loadRegistries(true);
					showToast(Toasts.success('Community registry added'));
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setIsAddingCommunity(false)
		);
	};

	const deleteTemplateRegistry = async (registry: TemplateRegistry) => {
		if (!canDeleteRegistries || !client) return;
		try {
			await client.templates.deleteRegistry({ id: registry.id });
			setRegistries((current) => current.filter((item) => item.id !== registry.id));
			invalidateTemplateRegistryCache();
			showToast(Toasts.success('Template registry deleted'));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	useItemDeleteConfirmation(pendingDeleteRegistry, setPendingDeleteRegistry, (registry) => ({
		title: 'Delete Template Registry',
		message: 'This removes the template registry.',
		icon: 'trash',
		actions: [{ title: 'Delete', action: () => void deleteTemplateRegistry(registry) }]
	}));

	const refresh = useCallback(async () => {
		if (!canViewRegistries) return;
		await loadRegistries(true);
	}, [canViewRegistries, loadRegistries]);

	return {
		registries,
		isLoading,
		errorMessage,
		isAddingCommunity,
		hasCommunityRegistry,
		canViewRegistries,
		canCreateRegistries,
		canUpdateRegistries,
		canDeleteRegistries,
		refresh,
		retry: () => void loadRegistries(true),
		addCommunityRegistry: () => void addCommunityRegistry(),
		openCreate: () => navigation.openRegistryForm({ onSuccess: afterSave }),
		openEdit: (registry: TemplateRegistry) =>
			navigation.openRegistryForm({ registry, onSuccess: afterSave }),
		requestDelete: setPendingDeleteRegistry
	};
}

export type TemplateRegistriesModel = ReturnType<typeof useTemplateRegistries>;

export function templateRegistryDetails(registry: TemplateRegistry) {
	const rows = [{ icon: 'link', label: 'URL', value: registry.url }];
	if (registry.lastFetchError)
		rows.push({
			icon: 'exclamationmark.triangle',
			label: 'Last Fetch Error',
			value: registry.lastFetchError
		});
	return rows;
}
