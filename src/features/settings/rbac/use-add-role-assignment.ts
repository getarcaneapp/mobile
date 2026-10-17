import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { Role } from '@/sdk/models/role/Role';
import type { RoleAssignment, UserAssignmentInput } from '@/sdk/models/role/RoleAssignment';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';

import {
	formatValidationFields,
	isManualAssignment,
	validationFields,
	type AssignmentScope
} from './rbac-models';

export type AddRoleAssignmentPayload = {
	userId: string;
	availableRoles: Role[];
	availableEnvironments: Environment[];
	existingAssignments: RoleAssignment[];
	onSaved: () => Promise<void>;
};

export function useAddRoleAssignment() {
	const nav = useSettingsNavigation();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => settingsPayloads.get<AddRoleAssignmentPayload>(token));

	const [selectedRoleId, setSelectedRoleId] = useState('');
	const [scope, setScope] = useState<AssignmentScope>('global');
	const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const canSave =
		selectedRoleId !== '' && (scope === 'global' || selectedEnvironmentId !== '') && !isSaving;

	const save = async () => {
		const client = useClientManager.getState().client;
		if (!client || !payload) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		const environmentId = scope === 'global' ? undefined : selectedEnvironmentId;
		const inputs: UserAssignmentInput[] = payload.existingAssignments
			.filter(isManualAssignment)
			.map((assignment) => ({
				roleId: assignment.roleId,
				environmentId: assignment.environmentId
			}));
		const added: UserAssignmentInput = { roleId: selectedRoleId, environmentId };
		if (
			!inputs.some(
				(input) => input.roleId === added.roleId && input.environmentId === added.environmentId
			)
		) {
			inputs.push(added);
		}
		try {
			await client.users.setRoleAssignments({ userId: payload.userId, assignments: inputs });
			showToast(Toasts.success('Role assigned'));
			await payload.onSaved();
			nav.back();
		} catch (error) {
			const fields = validationFields(error);
			setErrorMessage(fields ? formatValidationFields(fields) : friendlyErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	return {
		availableRoles: payload?.availableRoles ?? [],
		availableEnvironments: payload?.availableEnvironments ?? [],
		selectedRoleId,
		setSelectedRoleId,
		scope,
		setScope,
		selectedEnvironmentId,
		setSelectedEnvironmentId,
		errorMessage,
		canSave,
		save: () => void save(),
		cancel: nav.back
	};
}

export type AddRoleAssignmentModel = ReturnType<typeof useAddRoleAssignment>;
