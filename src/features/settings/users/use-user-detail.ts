import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { User, type UpdateUser } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { useSupportsRoleManagement } from '../rbac/rbac-models';
import type { UserRoleAssignmentsPayload } from '../rbac/use-user-role-assignments';
import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';

export type UserDetailPayload = { user: User; onUpdate: () => Promise<void> };

export function useUserDetail() {
	const nav = useSettingsNavigation();
	const params = useLocalSearchParams<{ id?: string; token?: string }>();
	const [payload] = useState(() => settingsPayloads.get<UserDetailPayload>(params.token));
	const [user, setUser] = useState<User | undefined>(payload?.user);
	const supportsV2 = useSupportsRoleManagement();

	const [email, setEmail] = useState(payload?.user.email ?? '');
	const [displayName, setDisplayName] = useState(payload?.user.displayName ?? '');
	const [isAdmin, setIsAdmin] = useState(payload ? User.isAdmin(payload.user) : false);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	useEffect(() => {
		if (user || !params.id) return;
		const client = useClientManager.getState().client;
		if (!client) return;
		let cancelled = false;
		client.users
			.get({ id: params.id })
			.then((loaded) => {
				if (cancelled) return;
				setUser(loaded);
				setEmail(loaded.email ?? '');
				setDisplayName(loaded.displayName ?? '');
				setIsAdmin(User.isAdmin(loaded));
			})
			.catch((error: unknown) => {
				if (!cancelled) setErrorMessage(friendlyErrorMessage(error));
			});
		return () => {
			cancelled = true;
		};
	}, [user, params.id]);

	const hasChanges =
		user !== undefined &&
		(email !== (user.email ?? '') ||
			displayName !== (user.displayName ?? '') ||
			(!supportsV2 && isAdmin !== User.isAdmin(user)));

	const revertChanges = () => {
		if (!user) return;
		setEmail(user.email ?? '');
		setDisplayName(user.displayName ?? '');
		setIsAdmin(User.isAdmin(user));
		setErrorMessage(undefined);
	};

	const saveUser = async () => {
		const client = useClientManager.getState().client;
		if (!client || !user) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		try {
			const body: UpdateUser = {
				displayName: displayName === '' ? undefined : displayName,
				email: email === '' ? undefined : email,
				roles: supportsV2 ? undefined : isAdmin ? ['admin'] : []
			};
			await client.users.update({ id: user.id, body });
			showToast(Toasts.success('User updated'));
			await payload?.onUpdate();
			nav.back();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	const openRoleAssignments = () => {
		if (!user) return;
		const handoff: UserRoleAssignmentsPayload = { user };
		nav.push('settings/rbac/user-role-assignments', {
			userId: user.id,
			token: settingsPayloads.put(handoff)
		});
	};

	return {
		user,
		title: user ? (user.displayName ? user.displayName : user.username) : '',
		supportsV2,
		email,
		setEmail,
		displayName,
		setDisplayName,
		isAdmin,
		setIsAdmin,
		isSaving,
		errorMessage,
		hasChanges,
		revertChanges,
		save: () => void saveUser(),
		openRoleAssignments
	};
}

export type UserDetailModel = ReturnType<typeof useUserDetail>;
