import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import { PaginationLoader } from '@/core/networking/pagination-loader';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { Role } from '@/sdk/models/role/Role';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads } from '../shared/settings-routes';
import {
	FederatedCredentialForm,
	type FederatedCredentialFormPayload
} from './federated-credential-form';
import { useCanManageFederated } from './use-federated-credentials';

export function useFederatedCredentialFormModel() {
	const router = useRouter();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const payload = settingsPayloads.get<FederatedCredentialFormPayload>(token);
	const credential = payload?.credential;
	const isGlobalAdmin = useCanManageFederated();
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const [form, setForm] = useState(() => FederatedCredentialForm.make(credential));
	const [roles, setRoles] = useState<Role[]>([]);
	const [environments, setEnvironments] = useState<Environment[]>([]);
	const [saving, setSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const presentationGeneration = useRef(-1);
	const initialGeneration = useRef(clientGeneration);

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const dismissForClientChange = useEffectEvent(dismiss);
	useEffect(() => {
		if (clientGeneration !== initialGeneration.current) dismissForClientChange();
	}, [clientGeneration]);

	useEffect(() => {
		const manager = useClientManager.getState();
		const client = manager.client;
		if (!client) return;
		presentationGeneration.current = manager.clientGeneration;
		let cancelled = false;
		const loadedRoles = PaginationLoader.collect(async (start, limit) => {
			const page = await client.roles.listPaginated({ start, limit });
			return { items: page.data, pagination: page.pagination };
		});
		const loadedEnvironments = PaginationLoader.collect(async (start, limit) => {
			const page = await client.environments.list({ query: { start, limit } });
			return { items: page.data, pagination: page.pagination };
		});
		Promise.all([loadedRoles, loadedEnvironments])
			.then(([nextRoles, nextEnvironments]) => {
				if (cancelled) return;
				setRoles(nextRoles);
				setEnvironments(nextEnvironments);
			})
			.catch((error: unknown) => {
				if (!cancelled) setErrorMessage(friendlyErrorMessage(error));
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const validationMessage = FederatedCredentialForm.validationMessage(form);
	const update = (patch: Partial<FederatedCredentialForm>) =>
		setForm((current) => ({ ...current, ...patch }));

	const save = async () => {
		const manager = useClientManager.getState();
		const client = manager.client;
		if (
			presentationGeneration.current !== manager.clientGeneration ||
			!isGlobalAdmin ||
			validationMessage !== undefined ||
			!client
		)
			return;
		const generation = manager.clientGeneration;
		setSaving(true);
		const notifySaved = async () => {
			await payload?.onSaved();
		};
		await withCleanup(
			async () => {
				try {
					if (credential)
						await client.federatedCredentials.update({
							id: credential.id,
							body: FederatedCredentialForm.updateRequest(form)
						});
					else
						await client.federatedCredentials.create({
							body: FederatedCredentialForm.createRequest(form)
						});
					if (generation !== useClientManager.getState().clientGeneration) return;
					await notifySaved();
					dismiss();
					showToast(Toasts.success('Credential saved'));
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setSaving(false)
		);
	};

	return {
		isEditing: credential !== undefined,
		title: credential ? 'Edit Credential' : 'Create Credential',
		confirmTitle: credential ? 'Save' : 'Create',
		expirationLocked: credential?.expiresAt !== undefined,
		form,
		update,
		roles,
		environments,
		saving,
		errorMessage,
		validationMessage,
		confirmDisabled: saving || validationMessage !== undefined || !isGlobalAdmin,
		save: () => void save(),
		cancel: dismiss
	};
}

export type FederatedCredentialFormModel = ReturnType<typeof useFederatedCredentialFormModel>;
