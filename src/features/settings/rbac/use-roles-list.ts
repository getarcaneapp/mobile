import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { useDebounced, useOnChange } from '@/features/containers/hooks';
import type { PermissionsManifest } from '@/sdk/models/role/PermissionsManifest';
import type { Role } from '@/sdk/models/role/Role';
import { useClientManager } from '@/stores/client-manager';
import { singleActionConfig, useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { ListUX } from '@/ui/components/paginated-list.types';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';
import { useProgressiveList } from '../shared/use-progressive-list';

import {
	conflictMessage,
	roleDisplayName,
	useCanManageRoles,
	useSupportsRoleManagement
} from './rbac-models';
import type { RoleDetailPayload } from './use-role-detail';

const pageSize = 50;

export function useRolesList() {
	const nav = useSettingsNavigation();
	const client = useClientManager((s) => s.client);
	const rbacAvailable = useSupportsRoleManagement();
	const canManageRoles = useCanManageRoles();
	const canAccessOIDCMappings = useClientManager((s) => s.canAccess('oidcRoleMappings'));
	useClientManager((s) => s.accessGeneration);

	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, ListUX.searchDebounce);
	const [manifest, setManifest] = useState<PermissionsManifest>();
	const [pendingDeleteRole, setPendingDeleteRole] = useState<Role>();
	const [actionErrorMessage, setActionErrorMessage] = useState<string>();

	const list = useProgressiveList<Role>({
		pageSize,
		search: debouncedSearch,
		fetchPage:
			rbacAvailable && client
				? (search, start, limit) => client.roles.listPaginated({ search, start, limit })
				: undefined,
		beforeFirstPage: client
			? async () => {
					setManifest(await client.roles.availablePermissions());
				}
			: undefined
	});
	const { load } = list;

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);
	useOnChange(debouncedSearch, () => void load());

	const deleteRole = async (role: Role) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			await current.roles.delete({ id: role.id });
			list.removeItem(role.id);
			await load();
			showToast(Toasts.success('Role deleted'));
		} catch (error) {
			const conflict = conflictMessage(error);
			setActionErrorMessage(
				conflict
					? (conflict.message ??
							"This role can't be deleted because it would leave the system with no administrators.")
					: friendlyErrorMessage(error)
			);
		}
	};

	useItemDeleteConfirmation(pendingDeleteRole, setPendingDeleteRole, (role) =>
		singleActionConfig({
			title: 'Delete Role',
			message: `Delete the “${roleDisplayName(role)}” role? This cannot be undone.`,
			icon: 'trash',
			confirmTitle: 'Delete',
			dismissOnConfirm: false,
			onConfirm: () => void deleteRole(role)
		})
	);

	const builtIns = list.items.filter((role) => role.builtIn);
	const customs = list.items.filter((role) => !role.builtIn);

	const openRole = (role: Role) => {
		const payload: RoleDetailPayload = {
			role,
			manifest,
			mode: role.builtIn ? 'readOnly' : 'edit',
			onUpdate: load
		};
		nav.push('settings/rbac/role', { id: role.id, token: settingsPayloads.put(payload) });
	};

	const openCreate = () => {
		const payload: RoleDetailPayload = {
			role: undefined,
			manifest,
			mode: 'create',
			onUpdate: load
		};
		nav.push('settings/rbac/new-role', { token: settingsPayloads.put(payload) });
	};

	return {
		...list,
		roles: list.items,
		builtIns,
		customs,
		rbacAvailable,
		canManageRoles,
		canAccessOIDCMappings,
		searchText,
		setSearchText,
		openRole,
		openCreate,
		openOIDCMappings: () => nav.push('oidcRoleMappings'),
		requestDelete: setPendingDeleteRole,
		actionErrorMessage,
		dismissActionError: () => setActionErrorMessage(undefined)
	};
}

export type RolesListModel = ReturnType<typeof useRolesList>;
