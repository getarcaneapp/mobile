/** The platform-neutral model behind `VariablesView` (VariablesView.swift). */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import { useDebounced } from '@/features/containers/hooks';
import {
	settingsPayloads,
	useSettingsNavigation
} from '@/features/settings/shared/settings-routes';
import { ArcaneError } from '@/sdk/errors/ArcaneError';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { Permission } from '@/sdk/models/role/Permission';
import type { GlobalVariable } from '@/sdk/models/variable/Variable';
import { useClientManager } from '@/stores/client-manager';
import { ListUX } from '@/ui/components/paginated-list.types';
import { showToast, Toasts } from '@/ui/toast';

import { syncSummary, useVariablesStore, type VariableSaveRequest } from './variables-store';

export const VariablesRoutes = {
	editor: 'settings/customize/variable-editor',
	delete: 'settings/customize/variable-delete'
} as const;

/** What `VariableEditorView` is initialised with. */
export interface VariableEditorPayload {
	variable?: GlobalVariable;
	environments: Environment[];
	onSave: (request: VariableSaveRequest) => Promise<void>;
}

/** What `DeleteVariableView` is initialised with. */
export interface DeleteVariablePayload {
	variable: GlobalVariable;
	onDelete: () => Promise<void>;
}

/** `manager.permissions.has(_, in: nil)` for every Variables permission, re-evaluated when access changes. */
function useVariablePermissions() {
	useClientManager((s) => s.accessGeneration);
	useClientManager((s) => s.currentUser);
	return {
		canRead: hasPermission(Permission.Variables.read, null),
		canCreate: hasPermission(Permission.Variables.create, null),
		canUpdate: hasPermission(Permission.Variables.update, null),
		canDelete: hasPermission(Permission.Variables.delete, null),
		canSync: hasPermission(Permission.Variables.sync, null)
	};
}

function requireClient() {
	const client = useClientManager.getState().client;
	if (!client) throw ArcaneError.transport('No Arcane client is available');
	return client;
}

export function useVariables() {
	const nav = useSettingsNavigation();
	const serverURL = useClientManager((s) => s.serverURL);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const permissions = useVariablePermissions();
	const { canRead, canCreate, canUpdate, canDelete, canSync } = permissions;
	const [store, snapshot] = useVariablesStore();
	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, ListUX.searchDebounce);
	const [showsSyncStatus, setShowsSyncStatus] = useState(false);

	const load = async () => {
		const client = useClientManager.getState().client;
		if (!canRead || !client) return;
		await store.load(client);
	};

	// `.task(id: manager.serverURL)`.
	useEffect(() => {
		if (!canRead) return;
		store.reset();
		const client = useClientManager.getState().client;
		if (client) void store.load(client);
	}, [store, serverURL, canRead]);

	// `.task(id: "\(serverURL)#\(clientGeneration)#\(pollingRevision)")`.
	const pollingRevision = snapshot.pollingRevision;
	useEffect(() => {
		const client = useClientManager.getState().client;
		if (!canRead || pollingRevision <= 0 || !client) return;
		let cancelled = false;
		void store.pollPendingSync(client, () => cancelled);
		return () => {
			cancelled = true;
		};
	}, [store, serverURL, clientGeneration, pollingRevision, canRead]);

	const displayedVariables = useMemo(() => {
		const query = debouncedSearch.trim().toLowerCase();
		if (query === '') return snapshot.variables;
		return snapshot.variables.filter(
			(variable) =>
				variable.key.toLowerCase().includes(query) ||
				(!variable.isSecret && variable.value.toLowerCase().includes(query)) ||
				store.scopeLabel(variable).toLowerCase().includes(query)
		);
	}, [snapshot.variables, debouncedSearch, store]);

	const syncVariables = async () => {
		const client = useClientManager.getState().client;
		if (!canSync || !client) return;
		void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
		try {
			await store.sync(client);
			showToast(Toasts.success('Variables synced'));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	const openEditor = (variable?: GlobalVariable) => {
		const payload: VariableEditorPayload = {
			variable,
			environments: store.getSnapshot().environments,
			onSave: async (request) => {
				if (
					(request.kind === 'create' && !canCreate) ||
					(request.kind === 'update' && !canUpdate)
				) {
					throw ArcaneError.forbidden();
				}
				await store.save(request, requireClient());
			}
		};
		nav.push(VariablesRoutes.editor, { token: settingsPayloads.put(payload) });
	};

	const requestDelete = (variable: GlobalVariable) => {
		const payload: DeleteVariablePayload = {
			variable,
			onDelete: async () => {
				if (!canDelete) throw ArcaneError.forbidden();
				await store.delete(variable, requireClient());
			}
		};
		nav.push(VariablesRoutes.delete, { token: settingsPayloads.put(payload) });
	};

	const copyKey = (variable: GlobalVariable) => {
		void Clipboard.setStringAsync(variable.key);
		showToast(Toasts.copied('Key copied'));
	};

	const copyValue = (variable: GlobalVariable) => {
		void Clipboard.setStringAsync(variable.value);
		showToast(Toasts.copied('Value copied'));
	};

	return {
		...permissions,
		snapshot,
		displayedVariables,
		searchText,
		setSearchText,
		showsSyncStatus,
		setShowsSyncStatus,
		summary: syncSummary(snapshot.syncStatuses),
		scopeLabel: (variable: GlobalVariable) => store.scopeLabel(variable),
		showsToolbar: canRead && !snapshot.isUnsupported,
		load,
		syncVariables,
		openEditor,
		requestDelete,
		copyKey,
		copyValue
	};
}

export type VariablesModel = ReturnType<typeof useVariables>;
