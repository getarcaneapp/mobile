import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { Role } from '@/sdk/models/role/Role';
import type { RoleAssignment, UserAssignmentInput } from '@/sdk/models/role/RoleAssignment';
import type { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { singleActionConfig, useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';

import {
	collectAllEnvironments,
	collectAllRoles,
	conflictMessage,
	displayScopeLabel,
	isManualAssignment,
	roleDisplayName
} from './rbac-models';
import type { AddRoleAssignmentPayload } from './use-add-role-assignment';

export type UserRoleAssignmentsPayload = { user: User };

export type AssignmentSection = { id: string; title: string; assignments: RoleAssignment[] };

export function useUserRoleAssignments() {
	const nav = useSettingsNavigation();
	const params = useLocalSearchParams<{ userId?: string; token?: string }>();
	const [payload] = useState(() => settingsPayloads.get<UserRoleAssignmentsPayload>(params.token));
	const userId = payload?.user.id ?? params.userId;

	const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
	const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
	const [availableEnvironments, setAvailableEnvironments] = useState<Environment[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [actionErrorMessage, setActionErrorMessage] = useState<string>();
	const [pendingRemoveAssignment, setPendingRemoveAssignment] = useState<RoleAssignment>();
	const assignmentsRef = useRef(assignments);
	assignmentsRef.current = assignments;

	const load = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client || !userId) return;
		if (assignmentsRef.current.length === 0) setIsLoading(true);
		setErrorMessage(undefined);
		try {
			const [loadedAssignments, roles, environments] = await Promise.all([
				client.users.getRoleAssignments({ userId }),
				collectAllRoles(client),
				collectAllEnvironments(client)
			]);
			setAssignments(loadedAssignments);
			setAvailableRoles(roles);
			setAvailableEnvironments(environments);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsLoading(false);
		}
	}, [userId]);

	useEffect(() => {
		void load();
	}, [load]);

	const roleFor = (assignment: RoleAssignment) =>
		availableRoles.find((role) => role.id === assignment.roleId);

	const remove = async (assignment: RoleAssignment) => {
		const client = useClientManager.getState().client;
		if (!client || !userId) return;
		const remainingManual: UserAssignmentInput[] = assignments
			.filter((item) => isManualAssignment(item) && item.id !== assignment.id)
			.map((item) => ({ roleId: item.roleId, environmentId: item.environmentId }));
		try {
			const updated = await client.users.setRoleAssignments({
				userId,
				assignments: remainingManual
			});
			setAssignments(updated);
			showToast(Toasts.success('Role assignment removed'));
		} catch (error) {
			const conflict = conflictMessage(error);
			setActionErrorMessage(
				conflict
					? (conflict.message ??
							'Cannot remove this assignment — at least one global administrator must remain.')
					: friendlyErrorMessage(error)
			);
		}
	};

	useItemDeleteConfirmation(pendingRemoveAssignment, setPendingRemoveAssignment, (assignment) => {
		const role = roleFor(assignment);
		const roleName = role ? roleDisplayName(role) : assignment.roleId;
		return singleActionConfig({
			title: 'Remove Assignment',
			message: `Remove the “${roleName}” role from this user?`,
			icon: 'person.crop.circle.badge.minus',
			confirmTitle: 'Remove',
			dismissOnConfirm: false,
			onConfirm: () => void remove(assignment)
		});
	});

	const global = assignments.filter((assignment) => assignment.environmentId === undefined);
	const perEnvironment = new Map<string, RoleAssignment[]>();
	for (const assignment of assignments) {
		if (assignment.environmentId === undefined) continue;
		const group = perEnvironment.get(assignment.environmentId) ?? [];
		group.push(assignment);
		perEnvironment.set(assignment.environmentId, group);
	}
	const sections: AssignmentSection[] = [
		...(global.length > 0 ? [{ id: 'global', title: 'Global', assignments: global }] : []),
		...[...perEnvironment.keys()]
			.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
			.map((envID) => ({
				id: envID,
				title: displayScopeLabel(envID, availableEnvironments),
				assignments: perEnvironment.get(envID) ?? []
			}))
	];

	const openAdd = () => {
		if (!userId) return;
		const handoff: AddRoleAssignmentPayload = {
			userId,
			availableRoles,
			availableEnvironments,
			existingAssignments: assignments,
			onSaved: load
		};
		nav.push('settings/rbac/add-role-assignment', { token: settingsPayloads.put(handoff) });
	};

	return {
		assignments,
		sections,
		availableRoles,
		isLoading,
		errorMessage,
		roleFor,
		canAdd: availableRoles.length > 0,
		openAdd,
		load,
		requestRemove: setPendingRemoveAssignment,
		actionErrorMessage,
		dismissActionError: () => setActionErrorMessage(undefined)
	};
}

export type UserRoleAssignmentsModel = ReturnType<typeof useUserRoleAssignments>;
