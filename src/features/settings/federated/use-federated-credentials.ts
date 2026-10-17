import { useEffect, useRef, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import { ServerCapabilities } from '@/sdk/client/ServerCapabilities';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import { SortOrder } from '@/sdk/models/base/pagination';
import type { FederatedCredential } from '@/sdk/models/federated/FederatedCredential';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';
import type {
	FederatedCredentialDetailPayload,
	FederatedCredentialFormPayload
} from './federated-credential-form';

export function useCanManageFederated(): boolean {
	const user = useClientManager((s) => s.currentUser);
	return user !== undefined && User.isGlobalAdmin(user);
}

export function useFederatedCredentials() {
	const navigation = useSettingsNavigation();
	const canManage = useCanManageFederated();
	useClientManager((s) => s.accessGeneration);
	const canRead = hasPermission('federated:read', null);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const baseURL = useClientManager((s) => s.client?.configuration.baseURL ?? '');
	const userID = useClientManager((s) => s.currentUser?.id ?? '');
	const [search, setSearch] = useState('');
	const identity = `${clientGeneration}|${baseURL}|${userID}|${search}`;

	const [credentials, setCredentials] = useState<FederatedCredential[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [loadMoreError, setLoadMoreError] = useState<string>();
	const [unsupported, setUnsupported] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<FederatedCredential>();

	const live = useRef({ identity, credentials, search });
	live.current = { identity, credentials, search };
	const requestID = useRef(0);
	const loadingIdentity = useRef<string | undefined>(undefined);
	const loadedIdentity = useRef('');

	const load = async (reset: boolean) => {
		const manager = useClientManager.getState();
		const client = manager.client;
		const caps = manager.serverCapabilities;
		if (
			!caps ||
			!ServerCapabilities.supportsRoleManagement(caps) ||
			!hasPermission('federated:list', null) ||
			!client
		)
			return;
		const key = live.current.identity;
		if (loadingIdentity.current === key) return;
		const request = ++requestID.current;
		loadingIdentity.current = key;
		let current = live.current.credentials;
		if (loadedIdentity.current !== key) {
			current = [];
			setCredentials([]);
			setTotal(0);
			loadedIdentity.current = key;
		}
		if (reset) setUnsupported(false);
		setLoading(true);
		setErrorMessage(undefined);
		setLoadMoreError(undefined);
		try {
			const result = await client.federatedCredentials.list({
				query: {
					search: live.current.search,
					start: reset ? 0 : current.length,
					limit: 30,
					sortBy: 'name',
					sortOrder: SortOrder.ascending
				}
			});
			if (key !== live.current.identity || requestID.current !== request) return;
			const base = reset ? [] : current;
			const merged = [
				...base,
				...result.data.filter((row) => !base.some((existing) => existing.id === row.id))
			];
			setCredentials(merged);
			setTotal(Math.trunc(result.pagination.totalItems));
		} catch (error) {
			if (key !== live.current.identity || requestID.current !== request) return;
			setUnsupported(isArcaneError(error, 'notFound'));
			if (reset) setErrorMessage(friendlyErrorMessage(error));
			else setLoadMoreError(friendlyErrorMessage(error));
		} finally {
			if (requestID.current === request) {
				setLoading(false);
				loadingIdentity.current = undefined;
			}
		}
	};

	const latestLoad = useRef(load);
	latestLoad.current = load;
	const reload = () => latestLoad.current(true);

	useEffect(() => {
		void latestLoad.current(true);
	}, [identity]);

	useItemDeleteConfirmation(pendingDelete, setPendingDelete, (credential) => ({
		title: 'Delete Credential',
		message: `Delete ${credential.name} and its service user?`,
		icon: 'trash',
		actions: [
			{
				title: 'Delete',
				action: () => {
					void (async () => {
						const client = useClientManager.getState().client;
						const user = useClientManager.getState().currentUser;
						if (!user || !User.isGlobalAdmin(user) || !client) return;
						try {
							await client.federatedCredentials.delete({ id: credential.id });
							await reload();
							showToast(Toasts.success('Credential deleted'));
						} catch (error) {
							showToast(Toasts.error(friendlyErrorMessage(error)));
						}
					})();
				}
			}
		]
	}));

	const showCreate = () => {
		const payload: FederatedCredentialFormPayload = { onSaved: reload };
		navigation.push('settings/federated/form', { token: settingsPayloads.put(payload) });
	};

	const openDetail = (credential: FederatedCredential) => {
		const payload: FederatedCredentialDetailPayload = { credential, onSaved: reload };
		navigation.push('settings/federated/detail', { token: settingsPayloads.put(payload) });
	};

	return {
		canManage,
		canRead,
		search,
		setSearch,
		credentials,
		hasMore: credentials.length < total,
		loading,
		errorMessage,
		loadMoreError,
		unsupported,
		reload,
		loadMore: () => void latestLoad.current(false),
		showCreate,
		openDetail,
		requestDelete: setPendingDelete
	};
}

export type FederatedCredentialsModel = ReturnType<typeof useFederatedCredentials>;
