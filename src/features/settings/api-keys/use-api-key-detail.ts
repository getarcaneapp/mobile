import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import { escapedPathComponent } from '@/core/networking/server-identity';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { APIKey, APIKeyCreated } from '@/sdk/models/apiKey/APIKey';
import type { ApiKeyPermissionGrant } from '@/sdk/models/role/ApiKeyPermissionGrant';
import { useClientManager } from '@/stores/client-manager';
import { systemColors } from '@/theme/colors';
import {
	useDeleteConfirmation,
	useItemDeleteConfirmation
} from '@/ui/components/delete-confirmation';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';
import { useAPIKeyAccess } from './api-key-access';
import {
	APIKeySecretPresentation,
	apiKeyIsExpired,
	invalidateAPIKeyCache,
	type APIKeyDetailPayload,
	type APIKeyMutationRequest,
	type APIKeyServerMetadata,
	type EditAPIKeyPayload
} from './api-key-models';
import { useSecretPresentation } from './use-api-keys';

const loadingAccessReason = 'Loading key access…';

function decodeMetadata(raw: unknown): APIKeyServerMetadata | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const o = raw as Record<string, unknown>;
	const permissions = Array.isArray(o.permissions)
		? o.permissions.flatMap((grant): ApiKeyPermissionGrant[] => {
				if (typeof grant !== 'object' || grant === null) return [];
				const g = grant as Record<string, unknown>;
				if (typeof g.permission !== 'string') return [];
				return [
					{
						permission: g.permission,
						environmentId: typeof g.environmentId === 'string' ? g.environmentId : undefined
					}
				];
			})
		: undefined;
	return {
		kind: typeof o.kind === 'string' ? o.kind : undefined,
		isBootstrap: typeof o.isBootstrap === 'boolean' ? o.isBootstrap : undefined,
		permissions
	};
}

async function revokeAPIKey(
	client: ArcaneClient,
	apiKey: APIKey,
	isPersonal: boolean
): Promise<boolean> {
	try {
		if (isPersonal)
			await client.rest.deleteVoid(`auth/me/api-keys/${escapedPathComponent(apiKey.id)}`);
		else await client.apiKeys.delete({ id: apiKey.id });
		return true;
	} catch {
		return false;
	}
}

async function rotateAPIKey(
	client: ArcaneClient,
	apiKey: APIKey,
	isPersonal: boolean,
	body: APIKeyMutationRequest
): Promise<{ created: APIKeyCreated; oldKeyRevoked: boolean }> {
	const created = await client.rest.post<APIKeyCreated>(
		isPersonal ? 'auth/me/api-keys' : 'api-keys',
		{ body }
	);
	const oldKeyRevoked = await revokeAPIKey(client, apiKey, isPersonal);
	return { created, oldKeyRevoked };
}

export function useAPIKeyDetail() {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const payload = settingsPayloads.get<APIKeyDetailPayload>(token);
	const navigation = useSettingsNavigation();
	const stack = useNavigation();
	const access = useAPIKeyAccess();
	const currentUserID = useClientManager((s) => s.currentUser?.id);
	const [apiKey, setApiKey] = useState<APIKey | undefined>(payload?.apiKey);
	const [metadata, setMetadata] = useState<APIKeyServerMetadata>();
	const [metadataLoaded, setMetadataLoaded] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<ActionButtonItem>();
	const [showRotateConfirmation, setShowRotateConfirmation] = useState(false);
	const [runningActionID, setRunningActionID] = useState<string>();
	const afterReveal = useRef({ refresh: false, dismiss: false });

	const dismiss = () => {
		if (stack.canGoBack()) stack.goBack();
	};
	const onChanged = async () => {
		await payload?.onChanged();
	};

	const loadMetadata = async (key: APIKey | undefined = apiKey) => {
		const client = useClientManager.getState().client;
		if (!client || !key) {
			setMetadataLoaded(true);
			return;
		}
		await withCleanup(
			async () => {
				try {
					const raw = await client.rest.get<unknown>(`api-keys/${escapedPathComponent(key.id)}`);
					setMetadata(decodeMetadata(raw));
				} catch {
					setMetadata(undefined);
				}
			},
			() => setMetadataLoaded(true)
		);
	};

	const initialLoad = useRef(loadMetadata);
	useEffect(() => {
		void initialLoad.current();
	}, []);

	const isProtected = apiKey !== undefined && (apiKey.isStatic || metadata?.isBootstrap === true);
	const isExpired = apiKey !== undefined && apiKeyIsExpired(apiKey);

	let kindLabel = 'Standard';
	if (apiKey?.isStatic) kindLabel = 'Static';
	else if (metadata?.isBootstrap === true) kindLabel = 'Environment';
	else if (metadata?.kind === 'personal') kindLabel = 'Personal';
	else if (access.supportsRBAC) kindLabel = 'Scoped';

	const rotationUnavailableReason = ((): string | undefined => {
		if (isProtected) return 'Environment-managed keys cannot be rotated here.';
		if (apiKey?.userId !== currentUserID) {
			return 'Only the assigned user can rotate this key without changing its ownership.';
		}
		if (!(access.canCreate && access.canDelete)) {
			return 'Creating and deleting API keys are both required to rotate this key.';
		}
		if (access.supportsRBAC) {
			if (!metadataLoaded) return loadingAccessReason;
			if (!metadata)
				return "This key's access could not be loaded, so it cannot be rotated safely.";
			if (
				metadata.kind !== 'personal' &&
				(metadata.permissions === undefined || metadata.permissions.length === 0)
			) {
				return 'This key has no reusable permission grants, so it cannot be rotated safely.';
			}
		}
		return undefined;
	})();

	const deleteKey = async () => {
		const client = useClientManager.getState().client;
		if (!client || !apiKey) return;
		setRunningActionID('delete');
		await withCleanup(
			async () => {
				try {
					await client.apiKeys.delete({ id: apiKey.id });
					invalidateAPIKeyCache();
					showToast(Toasts.success('API key deleted'));
					await onChanged();
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setRunningActionID(undefined)
		);
	};

	const finishSecretPresentation = () => {
		if (!afterReveal.current.refresh) return;
		const shouldDismiss = afterReveal.current.dismiss;
		afterReveal.current = { refresh: false, dismiss: false };
		void (async () => {
			invalidateAPIKeyCache();
			if (shouldDismiss) dismiss();
			await onChanged();
			if (shouldDismiss) showToast(Toasts.success('API key rotated'));
		})();
	};
	const presentSecret = useSecretPresentation(finishSecretPresentation);

	const rotateKey = async () => {
		const client = useClientManager.getState().client;
		if (rotationUnavailableReason !== undefined || !client || !apiKey) return;
		setRunningActionID('rotate');
		const isPersonal = access.supportsRBAC && metadata?.kind === 'personal';
		const permissions = access.supportsRBAC && !isPersonal ? metadata?.permissions : undefined;
		const body: APIKeyMutationRequest = {
			name: apiKey.name,
			description: apiKey.description,
			expiresAt: apiKey.expiresAt,
			permissions
		};
		await withCleanup(
			async () => {
				try {
					const { created, oldKeyRevoked } = await rotateAPIKey(client, apiKey, isPersonal, body);
					afterReveal.current = { refresh: true, dismiss: oldKeyRevoked };
					presentSecret(APIKeySecretPresentation.rotated(created.key, oldKeyRevoked));
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setRunningActionID(undefined)
		);
	};

	const showEditSheet = () => {
		if (!apiKey) return;
		const edit: EditAPIKeyPayload = {
			apiKey,
			metadata,
			onSaved: async (updated) => {
				setApiKey(updated);
				invalidateAPIKeyCache();
				await loadMetadata(updated);
				await onChanged();
			}
		};
		navigation.push('settings/api-keys/edit', { token: settingsPayloads.put(edit) });
	};

	const actionItems: ActionButtonItem[] = [];
	if (access.canUpdate && !isProtected) {
		actionItems.push({
			id: 'edit',
			title: 'Edit',
			systemImage: 'pencil',
			tint: systemColors.blue,
			action: showEditSheet
		});
	}
	if (rotationUnavailableReason === undefined) {
		actionItems.push({
			id: 'rotate',
			title: 'Rotate',
			systemImage: 'arrow.triangle.2.circlepath',
			tint: systemColors.orange,
			action: () => setShowRotateConfirmation(true)
		});
	}
	if (access.canDelete && !isProtected) {
		actionItems.push({
			id: 'delete',
			title: 'Delete',
			systemImage: 'trash',
			tint: systemColors.red,
			role: 'destructive',
			confirmationMessage:
				'This permanently revokes the API key. Anything using it will stop working.',
			action: () => void deleteKey()
		});
	}

	const name = apiKey?.name ?? '';
	useItemDeleteConfirmation(pendingDelete, setPendingDelete, (item) => ({
		title: `${item.title} ${name}?`,
		message: item.confirmationMessage ?? 'This action cannot be undone.',
		icon: item.systemImage,
		actions: [{ title: item.title, action: item.action }]
	}));
	useDeleteConfirmation(showRotateConfirmation, setShowRotateConfirmation, {
		title: `Rotate ${name}?`,
		message: `A replacement with the same access will be created before this key is revoked. Anything using ${apiKey?.keyPrefix ?? ''}… must be updated with the new key.`,
		icon: 'arrow.triangle.2.circlepath',
		actions: [
			{ title: 'Rotate', role: null, tint: systemColors.orange, action: () => void rotateKey() }
		],
		dismissOnConfirm: false
	});

	const copyPrefix = () => {
		if (!apiKey) return;
		void Clipboard.setStringAsync(apiKey.keyPrefix);
		showToast(Toasts.copied('Key prefix copied'));
	};

	return {
		apiKey,
		assignedUser: payload?.assignedUser,
		access,
		metadata,
		isProtected,
		isExpired,
		kindLabel,
		rotationNotice:
			rotationUnavailableReason === loadingAccessReason ? undefined : rotationUnavailableReason,
		actionItems,
		runningActionID,
		requestAction: (item: ActionButtonItem) =>
			item.role === 'destructive' ? setPendingDelete(item) : item.action(),
		copyPrefix
	};
}

export type APIKeyDetailModel = ReturnType<typeof useAPIKeyDetail>;
