/**
 * The model behind `OIDCMappingFormSheet` (OIDCRoleMappingsView.swift):
 * claim value, role and scope with dirty tracking, revert, and create/update.
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { OidcRoleMapping } from '@/sdk/models/role/OidcRoleMapping';
import type { Role } from '@/sdk/models/role/Role';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';

import { formatValidationFields, validationFields, type AssignmentScope } from './rbac-models';

export type OIDCMappingFormPayload = {
	editing: OidcRoleMapping | undefined;
	availableRoles: Role[];
	availableEnvironments: Environment[];
	onSaved: () => Promise<void>;
};

const scopeOf = (mapping: OidcRoleMapping | undefined): AssignmentScope =>
	mapping?.environmentId === undefined ? 'global' : 'environment';

export function useOIDCMappingForm() {
	const nav = useSettingsNavigation();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => settingsPayloads.get<OIDCMappingFormPayload>(token));
	const editing = payload?.editing;

	const [claimValue, setClaimValue] = useState(editing?.claimValue ?? '');
	const [roleId, setRoleId] = useState(editing?.roleId ?? '');
	const [scope, setScope] = useState<AssignmentScope>(scopeOf(editing));
	const [environmentId, setEnvironmentId] = useState(editing?.environmentId ?? '');
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const canSave =
		claimValue !== '' && roleId !== '' && (scope === 'global' || environmentId !== '') && !isSaving;

	const persistedEnvironmentId = scope === 'global' ? '' : environmentId;
	const hasChanges = editing
		? claimValue !== editing.claimValue ||
			roleId !== editing.roleId ||
			scope !== scopeOf(editing) ||
			persistedEnvironmentId !== (editing.environmentId ?? '')
		: claimValue !== '' || roleId !== '' || scope !== 'global' || persistedEnvironmentId !== '';

	const revertChanges = () => {
		setClaimValue(editing?.claimValue ?? '');
		setRoleId(editing?.roleId ?? '');
		setScope(scopeOf(editing));
		setEnvironmentId(editing?.environmentId ?? '');
		setErrorMessage(undefined);
	};

	const save = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		const body = {
			claimValue,
			roleId,
			environmentId: scope === 'global' ? undefined : environmentId
		};
		try {
			if (editing) {
				await client.oidcRoleMappings.update({ id: editing.id, body });
			} else {
				await client.oidcRoleMappings.create({ body });
			}
			showToast(Toasts.success(editing ? 'Role mapping updated' : 'Role mapping created'));
			await payload?.onSaved();
			nav.back();
		} catch (error) {
			const fields = validationFields(error);
			setErrorMessage(fields ? formatValidationFields(fields) : friendlyErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	return {
		title: editing ? 'Edit Mapping' : 'New Mapping',
		availableRoles: payload?.availableRoles ?? [],
		availableEnvironments: payload?.availableEnvironments ?? [],
		claimValue,
		setClaimValue,
		roleId,
		setRoleId,
		scope,
		setScope,
		environmentId,
		setEnvironmentId,
		isSaving,
		errorMessage,
		canSave,
		hasChanges,
		revertChanges,
		save: () => void save(),
		cancel: nav.back
	};
}

export type OIDCMappingFormModel = ReturnType<typeof useOIDCMappingForm>;
