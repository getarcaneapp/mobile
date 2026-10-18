import { useRouter } from 'expo-router';
import { useState } from 'react';

import { withCleanup } from '@/core/with-cleanup';
import { friendlyErrorMessage } from '@/core/errors';
import type { TemplateRegistry } from '@/sdk/models/template/Template';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { useRoutePayload, type TemplateRegistryFormPayload } from './template-routes';

type Draft = { name: string; url: string; description: string; enabled: boolean };

const populate = (registry: TemplateRegistry | undefined): Draft =>
	registry
		? {
				name: registry.name,
				url: registry.url,
				description: registry.description,
				enabled: registry.enabled
			}
		: { name: '', url: '', description: '', enabled: true };

export function useTemplateRegistryForm() {
	const { payload } = useRoutePayload<TemplateRegistryFormPayload>();
	const router = useRouter();
	const client = useClientManager((s) => s.client);
	const registry = payload?.registry;
	const isEditing = registry !== undefined;

	const [draft, setDraft] = useState<Draft>(() => populate(registry));
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

	const hasChanges = registry
		? draft.name !== registry.name ||
			draft.url !== registry.url ||
			draft.description !== registry.description ||
			draft.enabled !== registry.enabled
		: draft.name !== '' || draft.url !== '' || draft.description !== '' || !draft.enabled;

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const saveRegistry = async () => {
		if (!client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		const successMessage =
			registry === undefined ? 'Template registry created' : 'Template registry updated';
		await withCleanup(
			async () => {
				try {
					const body = {
						name: draft.name,
						url: draft.url,
						description: draft.description,
						enabled: draft.enabled
					};
					if (registry) {
						await client.templates.updateRegistry({ id: registry.id, body });
					} else {
						await client.templates.createRegistry({ body });
					}
					showToast(Toasts.success(successMessage));
					if (payload) await payload.onSuccess();
					dismiss();
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsLoading(false)
		);
	};

	return {
		draft,
		update,
		isEditing,
		title: isEditing ? 'Edit Template Registry' : 'Add Template Registry',
		saveAccessibilityLabel: isEditing ? 'Save' : 'Add',
		hasChanges,
		canSave: draft.name !== '' && draft.url !== '',
		isLoading,
		errorMessage,
		save: () => void saveRegistry(),
		revertChanges: () => {
			setDraft(populate(registry));
			setErrorMessage(undefined);
		},
		cancel: dismiss
	};
}
