import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { withCleanup } from '@/core/with-cleanup';
import { friendlyErrorMessage } from '@/core/errors';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { OidcRoleMapping, OidcRoleMappingSource } from '@/sdk/models/role/OidcRoleMapping';
import type { Role } from '@/sdk/models/role/Role';
import { useClientManager } from '@/stores/client-manager';
import { singleActionConfig, useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';

import {
	collectAllEnvironments,
	collectAllRoles,
	useCanManageOIDCMappings,
	useSupportsRoleManagement
} from './rbac-models';
import type { OIDCMappingFormPayload } from './use-oidc-mapping-form';

export const isManualMapping = (mapping: OidcRoleMapping) =>
	OidcRoleMapping.sourceKind(mapping) === OidcRoleMappingSource.manual;

export function useOIDCRoleMappings() {
	const nav = useSettingsNavigation();
	const rbacAvailable = useSupportsRoleManagement();
	const canManage = useCanManageOIDCMappings();

	const [mappings, setMappings] = useState<OidcRoleMapping[]>([]);
	const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
	const [availableEnvironments, setAvailableEnvironments] = useState<Environment[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [actionErrorMessage, setActionErrorMessage] = useState<string>();
	const [pendingDeleteMapping, setPendingDeleteMapping] = useState<OidcRoleMapping>();
	const mappingsRef = useRef(mappings);
	useLayoutEffect(() => {
		mappingsRef.current = mappings;
	});

	const load = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!rbacAvailable || !client) return;
		if (mappingsRef.current.length === 0) setIsLoading(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				try {
					const [loadedMappings, roles, environments] = await Promise.all([
						client.oidcRoleMappings.list(),
						collectAllRoles(client),
						collectAllEnvironments(client)
					]);
					setMappings(loadedMappings);
					setAvailableRoles(roles);
					setAvailableEnvironments(environments);
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsLoading(false)
		);
	}, [rbacAvailable]);

	useEffect(() => {
		void load();
	}, [load]);

	const deleteMapping = async (mapping: OidcRoleMapping) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			await client.oidcRoleMappings.delete({ id: mapping.id });
			setMappings(mappingsRef.current.filter((item) => item.id !== mapping.id));
			showToast(Toasts.success('Role mapping deleted'));
		} catch (error) {
			setActionErrorMessage(friendlyErrorMessage(error));
		}
	};

	useItemDeleteConfirmation(pendingDeleteMapping, setPendingDeleteMapping, (mapping) =>
		singleActionConfig({
			title: 'Delete Mapping',
			message: `Delete the mapping for “${mapping.claimValue}”? Users won't receive this role on their next login.`,
			icon: 'trash',
			confirmTitle: 'Delete',
			dismissOnConfirm: false,
			onConfirm: () => void deleteMapping(mapping)
		})
	);

	const openForm = (editing: OidcRoleMapping | undefined) => {
		const payload: OIDCMappingFormPayload = {
			editing,
			availableRoles,
			availableEnvironments,
			onSaved: load
		};
		nav.push('settings/rbac/oidc-mapping', { token: settingsPayloads.put(payload) });
	};

	return {
		rbacAvailable,
		canManage,
		mappings,
		availableRoles,
		availableEnvironments,
		isLoading,
		errorMessage,
		load,
		roleFor: (mapping: OidcRoleMapping) =>
			availableRoles.find((role) => role.id === mapping.roleId),
		openCreate: () => openForm(undefined),
		openEdit: (mapping: OidcRoleMapping) => {
			if (isManualMapping(mapping)) openForm(mapping);
		},
		requestDelete: setPendingDeleteMapping,
		actionErrorMessage,
		dismissActionError: () => setActionErrorMessage(undefined)
	};
}

export type OIDCRoleMappingsModel = ReturnType<typeof useOIDCRoleMappings>;
