import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { PermissionsManifest } from '@/sdk/models/role/PermissionsManifest';
import type { Role } from '@/sdk/models/role/Role';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';

import { formatValidationFields, roleDisplayName, validationFields } from './rbac-models';

export type RoleDetailMode = 'create' | 'edit' | 'readOnly';

export type RoleDetailPayload = {
	role: Role | undefined;
	manifest: PermissionsManifest | undefined;
	mode: RoleDetailMode;
	onUpdate: () => Promise<void>;
};

function sameSet(a: Set<string>, b: Set<string>) {
	if (a.size !== b.size) return false;
	for (const value of a) if (!b.has(value)) return false;
	return true;
}

export function useRoleDetail(fallbackMode: RoleDetailMode) {
	const nav = useSettingsNavigation();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => settingsPayloads.get<RoleDetailPayload>(token));
	const role = payload?.role;
	const mode = payload?.mode ?? fallbackMode;
	const isReadOnly = mode === 'readOnly';

	const [manifest, setManifest] = useState(payload?.manifest);
	const [name, setName] = useState(role?.name ?? '');
	const [description, setDescription] = useState(role?.description ?? '');
	const [selectedPermissions, setSelectedPermissions] = useState(
		() => new Set(role?.permissions ?? [])
	);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [search, setSearch] = useState('');

	const hasManifest = manifest !== undefined;
	useEffect(() => {
		const client = useClientManager.getState().client;
		if (hasManifest || !client) return;
		let cancelled = false;
		client.roles
			.availablePermissions()
			.then((loaded) => {
				if (!cancelled) setManifest(loaded);
			})
			.catch((error: unknown) => {
				if (!cancelled) setErrorMessage(friendlyErrorMessage(error));
			});
		return () => {
			cancelled = true;
		};
	}, [hasManifest]);

	const hasChanges = role
		? name !== role.name ||
			description !== (role.description ?? '') ||
			!sameSet(selectedPermissions, new Set(role.permissions))
		: name !== '' || description !== '' || selectedPermissions.size > 0;

	const canSave = name !== '' && selectedPermissions.size > 0;

	const revertChanges = () => {
		setName(role?.name ?? '');
		setDescription(role?.description ?? '');
		setSelectedPermissions(new Set(role?.permissions ?? []));
		setErrorMessage(undefined);
	};

	const setPermissions = (permissions: string[], selected: boolean) => {
		setSelectedPermissions((current) => {
			const next = new Set(current);
			for (const permission of permissions) {
				if (selected) next.add(permission);
				else next.delete(permission);
			}
			return next;
		});
	};

	const save = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		const body = {
			name,
			description: description === '' ? undefined : description,
			permissions: [...selectedPermissions]
		};
		try {
			if (role) {
				await client.roles.update({ id: role.id, body });
			} else {
				await client.roles.create({ body });
			}
			showToast(Toasts.success(role ? 'Role updated' : 'Role created'));
			await payload?.onUpdate();
			nav.back();
		} catch (error) {
			const fields = validationFields(error);
			setErrorMessage(fields ? formatValidationFields(fields) : friendlyErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	return {
		mode,
		isReadOnly,
		title: mode === 'create' ? 'New Role' : role ? roleDisplayName(role) : 'Role',
		manifest,
		name,
		setName,
		description,
		setDescription,
		selectedPermissions,
		setPermissions,
		search,
		setSearch,
		isSaving,
		errorMessage,
		hasChanges,
		canSave,
		revertChanges,
		save: () => void save(),
		cancel: nav.back
	};
}

export type RoleDetailModel = ReturnType<typeof useRoleDetail>;
