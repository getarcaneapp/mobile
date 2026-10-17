/**
 * The model behind UsersView.swift: progressive pagination with debounced
 * search, delete confirmation + failure alert, and the pushes to the user
 * detail, create sheet and user settings. Shared by both platforms.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { cachedClient } from '@/core/networking/use-cached-client';
import { useDebounced, useOnChange } from '@/features/containers/hooks';
import type { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { singleActionConfig, useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { ListUX } from '@/ui/components/paginated-list.types';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';
import { useProgressiveList } from '../shared/use-progressive-list';

import type { CreateUserPayload } from './use-create-user';
import type { UserDetailPayload } from './use-user-detail';

const pageSize = 50;

/** `user.displayUsername`: prefer a non-empty display name. */
export function displayUsername(user: User): string {
	return user.displayName ? user.displayName : user.username;
}

/** `cached.invalidateGlobal(paths: ["users", "users/*"])`. */
export function invalidateUsersCache() {
	cachedClient()?.invalidateGlobal(['users', 'users/*']);
}

export function useUsersList() {
	const nav = useSettingsNavigation();
	const client = useClientManager((s) => s.client);
	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, ListUX.searchDebounce);
	const [pendingDeleteUser, setPendingDeleteUser] = useState<User>();
	const [actionErrorMessage, setActionErrorMessage] = useState<string>();

	const list = useProgressiveList<User>({
		pageSize,
		search: debouncedSearch,
		fetchPage: client
			? (search, start, limit) => client.users.listPaginated({ search, start, limit })
			: undefined
	});
	const { load } = list;

	// `.task { await loadUsers() }` runs each time the list appears.
	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);
	useOnChange(debouncedSearch, () => void load());

	const deleteUser = async (user: User) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		try {
			await current.users.delete({ id: user.id });
			list.removeItem(user.id);
			invalidateUsersCache();
			await load();
			showToast(Toasts.success('User deleted'));
		} catch (error) {
			setActionErrorMessage(friendlyErrorMessage(error));
		}
	};

	useItemDeleteConfirmation(pendingDeleteUser, setPendingDeleteUser, (user) =>
		singleActionConfig({
			title: 'Delete User',
			message: `Delete the user “${user.username}”? This permanently revokes their access.`,
			icon: 'trash',
			confirmTitle: 'Delete',
			// The list stays on screen after confirming (it's pushed from More).
			dismissOnConfirm: false,
			onConfirm: () => void deleteUser(user)
		})
	);

	const openUser = (user: User) => {
		const payload: UserDetailPayload = { user, onUpdate: load };
		nav.push('settings/users/user', { id: user.id, token: settingsPayloads.put(payload) });
	};

	const openCreate = () => {
		const payload: CreateUserPayload = {
			onSuccess: async () => {
				invalidateUsersCache();
				await load();
			}
		};
		nav.push('settings/users/create', { token: settingsPayloads.put(payload) });
	};

	const openSettings = () => nav.push('settings/users/settings');

	return {
		...list,
		users: list.items,
		searchText,
		setSearchText,
		requestDelete: setPendingDeleteUser,
		actionErrorMessage,
		dismissActionError: () => setActionErrorMessage(undefined),
		openUser,
		openCreate,
		openSettings
	};
}

export type UsersListModel = ReturnType<typeof useUsersList>;
