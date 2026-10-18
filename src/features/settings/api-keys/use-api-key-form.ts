import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { withCleanup } from '@/core/with-cleanup';
import { friendlyErrorMessage } from '@/core/errors';
import { escapedPathComponent } from '@/core/networking/server-identity';
import type { APIKey, APIKeyCreated } from '@/sdk/models/apiKey/APIKey';
import { formatArcaneDate, parseArcaneDate } from '@/sdk/models/base/date';
import type { ApiKeyPermissionGrant } from '@/sdk/models/role/ApiKeyPermissionGrant';
import type { PermissionsManifest } from '@/sdk/models/role/PermissionsManifest';
import { ArcaneValidationError } from '@/sdk/errors/ArcaneError';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads } from '../shared/settings-routes';
import { useAPIKeyAccess } from './api-key-access';
import {
	defaultExpirationDate,
	type APIKeyMutationRequest,
	type CreateAPIKeyPayload,
	type EditAPIKeyPayload
} from './api-key-models';

function formatValidationFields(fields: Record<string, string[]>): string {
	return Object.keys(fields)
		.sort()
		.map((key) => `${key}: ${(fields[key] ?? []).join(', ')}`)
		.join('\n');
}

function mutationErrorMessage(error: unknown): string {
	return error instanceof ArcaneValidationError
		? formatValidationFields(error.fields)
		: friendlyErrorMessage(error);
}

const grants = (selected: ReadonlySet<string>): ApiKeyPermissionGrant[] =>
	[...selected].sort().map((permission) => ({ permission }));

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
	a.size === b.size && [...a].every((value) => b.has(value));

const sameInstant = (a: Date | undefined, b: Date | undefined) =>
	a === undefined || b === undefined ? a === b : a.getTime() === b.getTime();

function useManifest(enabled: boolean, onError?: (message: string) => void) {
	const sessionManifest = useClientManager((s) => s.permissionsManifest);
	const [loadedManifest, setLoadedManifest] = useState<PermissionsManifest>();
	const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
	const manifest = loadedManifest ?? sessionManifest;
	const latest = useRef({ enabled, hasManifest: manifest !== undefined, onError });
	useLayoutEffect(() => {
		latest.current = { enabled, hasManifest: manifest !== undefined, onError };
	});

	useEffect(() => {
		const client = useClientManager.getState().client;
		if (!latest.current.enabled || latest.current.hasManifest || !client) return;
		setIsLoadingPermissions(true);
		client.roles
			.availablePermissions()
			.then(setLoadedManifest)
			.catch((error: unknown) => latest.current.onError?.(friendlyErrorMessage(error)))
			.finally(() => setIsLoadingPermissions(false));
	}, []);

	return { manifest, isLoadingPermissions };
}

function useSheetDismiss() {
	const router = useRouter();
	return () => {
		if (router.canGoBack()) router.back();
	};
}

export function useCreateAPIKey() {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const payload = settingsPayloads.get<CreateAPIKeyPayload>(token);
	const dismiss = useSheetDismiss();
	const { supportsRBAC } = useAPIKeyAccess();
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [hasExpiration, setHasExpiration] = useState(false);
	const [expiresAt, setExpiresAt] = useState(defaultExpirationDate);
	const [selectedPermissions, setSelectedPermissions] = useState<ReadonlySet<string>>(new Set());
	const [permissionSearch, setPermissionSearch] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const { manifest, isLoadingPermissions } = useManifest(supportsRBAC, setErrorMessage);

	const canCreate =
		name.trim() !== '' &&
		!isLoading &&
		(!supportsRBAC || (manifest !== undefined && selectedPermissions.size > 0));

	const createKey = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		const trimmedDescription = description.trim();
		const body: APIKeyMutationRequest = {
			name: name.trim(),
			description: trimmedDescription === '' ? undefined : trimmedDescription,
			expiresAt: hasExpiration ? formatArcaneDate(expiresAt) : undefined,
			permissions: supportsRBAC ? grants(selectedPermissions) : undefined
		};
		const notifyCreated = (key: string) => payload?.onCreated(key);
		await withCleanup(
			async () => {
				try {
					const created = await client.rest.post<APIKeyCreated>('api-keys', { body });
					showToast(Toasts.success('API key created'));
					notifyCreated(created.key);
					dismiss();
				} catch (error) {
					setErrorMessage(mutationErrorMessage(error));
				}
			},
			() => setIsLoading(false)
		);
	};

	return {
		supportsRBAC,
		manifest,
		isLoadingPermissions,
		name,
		setName,
		description,
		setDescription,
		hasExpiration,
		setHasExpiration,
		expiresAt,
		setExpiresAt,
		selectedPermissions,
		setSelectedPermissions,
		permissionSearch,
		setPermissionSearch,
		isLoading,
		errorMessage,
		canCreate,
		createKey: () => void createKey(),
		cancel: dismiss
	};
}

export type CreateAPIKeyModel = ReturnType<typeof useCreateAPIKey>;

export function useEditAPIKey() {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const payload = settingsPayloads.get<EditAPIKeyPayload>(token);
	const dismiss = useSheetDismiss();
	const { supportsRBAC } = useAPIKeyAccess();
	const apiKey: APIKey | undefined = payload?.apiKey;
	const metadata = payload?.metadata;
	const originalExpiresAt = parseArcaneDate(apiKey?.expiresAt);
	const [initialExpiresAt] = useState(() => originalExpiresAt ?? defaultExpirationDate());
	const [initialPermissions] = useState<ReadonlySet<string>>(
		() => new Set(metadata?.permissions?.map((grant) => grant.permission) ?? [])
	);
	const [name, setName] = useState(apiKey?.name ?? '');
	const [description, setDescription] = useState(apiKey?.description ?? '');
	const [hasExpiration, setHasExpiration] = useState(originalExpiresAt !== undefined);
	const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
	const [selectedPermissions, setSelectedPermissions] = useState(initialPermissions);
	const [permissionSearch, setPermissionSearch] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const isPersonal = metadata?.kind === 'personal';
	const { manifest, isLoadingPermissions } = useManifest(supportsRBAC && !isPersonal);
	const showsPermissionPicker =
		supportsRBAC && !isPersonal && metadata?.permissions !== undefined && manifest !== undefined;

	const hasChanges =
		name.trim() !== (apiKey?.name ?? '') ||
		description !== (apiKey?.description ?? '') ||
		!sameInstant(hasExpiration ? expiresAt : undefined, originalExpiresAt) ||
		(showsPermissionPicker && !sameSet(selectedPermissions, initialPermissions));

	const canSave =
		!isSaving &&
		hasChanges &&
		name.trim() !== '' &&
		(!showsPermissionPicker || selectedPermissions.size > 0);

	const revertChanges = () => {
		setName(apiKey?.name ?? '');
		setDescription(apiKey?.description ?? '');
		setHasExpiration(originalExpiresAt !== undefined);
		setExpiresAt(initialExpiresAt);
		setSelectedPermissions(initialPermissions);
		setErrorMessage(undefined);
	};

	const save = async () => {
		const client = useClientManager.getState().client;
		if (!client || !apiKey || !payload) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		const body: APIKeyMutationRequest = {
			name: name.trim(),
			description: description.trim(),
			expiresAt: hasExpiration ? formatArcaneDate(expiresAt) : undefined,
			permissions: showsPermissionPicker ? grants(selectedPermissions) : undefined
		};
		await withCleanup(
			async () => {
				try {
					const updated = await client.rest.put<APIKey>(
						`api-keys/${escapedPathComponent(apiKey.id)}`,
						{
							body
						}
					);
					await payload.onSaved(updated);
					showToast(Toasts.success('API key updated'));
					dismiss();
				} catch (error) {
					setErrorMessage(mutationErrorMessage(error));
				}
			},
			() => setIsSaving(false)
		);
	};

	return {
		apiKey,
		supportsRBAC,
		isPersonal,
		manifest,
		metadata,
		isLoadingPermissions,
		showsPermissionPicker,
		hadExpiration: originalExpiresAt !== undefined,
		name,
		setName,
		description,
		setDescription,
		hasExpiration,
		setHasExpiration,
		expiresAt,
		setExpiresAt,
		selectedPermissions,
		setSelectedPermissions,
		permissionSearch,
		setPermissionSearch,
		isSaving,
		errorMessage,
		hasChanges,
		canSave,
		save: () => void save(),
		revertChanges,
		cancel: dismiss
	};
}

export type EditAPIKeyModel = ReturnType<typeof useEditAPIKey>;
