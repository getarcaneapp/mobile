/**
 * The model behind CreateUserView.swift: credentials + email, the global role
 * picker on v2 servers (Administrator toggle on v1), create and the follow-up
 * role assignment. Shared by both platforms.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { Role } from '@/sdk/models/role/Role';
import type { CreateUser } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { collectAllRoles, useSupportsRoleManagement } from '../rbac/rbac-models';
import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';

export type CreateUserPayload = { onSuccess: () => Promise<void> };

export function useCreateUser() {
	const nav = useSettingsNavigation();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => settingsPayloads.get<CreateUserPayload>(token));
	const supportsRoleManagement = useSupportsRoleManagement();

	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [email, setEmail] = useState('');
	const [isAdmin, setIsAdmin] = useState(false);
	const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
	const [selectedRoleId, setSelectedRoleId] = useState('');
	const [isLoadingRoles, setIsLoadingRoles] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const canCreate =
		username !== '' &&
		password !== '' &&
		!isLoading &&
		(!supportsRoleManagement || selectedRoleId !== '');

	// `.task { await loadRolesIfNeeded() }`
	useEffect(() => {
		const client = useClientManager.getState().client;
		if (!supportsRoleManagement || !client) return;
		let cancelled = false;
		setIsLoadingRoles(true);
		collectAllRoles(client)
			.then((roles) => {
				if (cancelled) return;
				setAvailableRoles(roles);
				setSelectedRoleId(
					(current) =>
						current ||
						(roles.find((role) => role.id === Role.BuiltIn.viewer)?.id ?? roles[0]?.id ?? '')
				);
			})
			.catch((error: unknown) => {
				if (!cancelled) setErrorMessage(friendlyErrorMessage(error));
			})
			.finally(() => {
				if (!cancelled) setIsLoadingRoles(false);
			});
		return () => {
			cancelled = true;
		};
	}, [supportsRoleManagement]);

	const createUser = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		const supportsRBAC = supportsRoleManagement;
		try {
			const body: CreateUser = {
				username,
				password,
				displayName: undefined,
				email: email === '' ? undefined : email,
				roles: supportsRBAC ? undefined : isAdmin ? ['admin'] : ['user']
			};
			const created = await client.users.create({ body });
			if (supportsRBAC) {
				try {
					await client.users.setRoleAssignments({
						userId: created.id,
						assignments: [{ roleId: selectedRoleId }]
					});
				} catch (error) {
					setErrorMessage(
						`User created, but the role could not be assigned: ${friendlyErrorMessage(error)}`
					);
					await payload?.onSuccess();
					return;
				}
			}
			showToast(Toasts.success('User created'));
			await payload?.onSuccess();
			nav.back();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsLoading(false);
		}
	};

	return {
		supportsRoleManagement,
		username,
		setUsername,
		password,
		setPassword,
		email,
		setEmail,
		isAdmin,
		setIsAdmin,
		availableRoles,
		selectedRoleId,
		setSelectedRoleId,
		isLoadingRoles,
		errorMessage,
		canCreate,
		create: () => void createUser(),
		cancel: nav.back
	};
}

export type CreateUserModel = ReturnType<typeof useCreateUser>;
