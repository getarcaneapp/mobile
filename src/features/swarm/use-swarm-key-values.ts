import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { localizedStandardCompare } from '@/core/list-sort-order';
import type { EnvironmentID } from '@/sdk/client/environment';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { systemColors } from '@/theme/colors';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { useOnChange } from '@/features/containers/hooks';
import { screenCache } from '@/features/networks/tab-routes';

import {
	shortID,
	swarmChanged,
	swarmDate,
	swarmField,
	swarmString,
	useCan,
	useSwarmVersion
} from './swarm-common';
import {
	swarmKeys,
	useSwarmNavigation,
	type SwarmKeyValueItem,
	type SwarmKeyValueKind
} from './swarm-routes';

export const KeyValueKind = {
	title: (kind: SwarmKeyValueKind) => (kind === 'config' ? 'Configs' : 'Secrets'),
	singular: (kind: SwarmKeyValueKind) => (kind === 'config' ? 'Config' : 'Secret'),
	systemImage: (kind: SwarmKeyValueKind) => (kind === 'config' ? 'doc.text' : 'key.fill'),
	permission: (kind: SwarmKeyValueKind) =>
		kind === 'config' ? Permission.Swarm.configs : Permission.Swarm.secrets
};

export const parseKind = (value?: string): SwarmKeyValueKind =>
	value === 'secret' ? 'secret' : 'config';

export const itemName = (item: SwarmKeyValueItem) =>
	swarmString(swarmField(item.spec, 'Name')) ?? shortID(item.id);

export function decodedData(item: SwarmKeyValueItem): string | undefined {
	const base64 = swarmString(swarmField(item.spec, 'Data'));
	if (base64 === undefined) return undefined;
	try {
		const binary = atob(base64);
		const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return undefined;
	}
}

function base64UTF8(text: string) {
	const bytes = new TextEncoder().encode(text);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

async function deleteItem(
	kind: SwarmKeyValueKind,
	item: SwarmKeyValueItem,
	environmentID: EnvironmentID
) {
	const client = useClientManager.getState().client;
	if (!client) return false;
	if (kind === 'config')
		await client.swarm.deleteConfig({ configId: item.id, envID: environmentID });
	else await client.swarm.deleteSecret({ secretId: item.id, envID: environmentID });
	return true;
}

export function useSwarmKeyValues() {
	const { envID = '0', kind: kindParam } = useLocalSearchParams<{
		envID?: string;
		kind?: string;
	}>();
	const environmentID = envID;
	const kind = parseKind(kindParam);
	const swarm = useSwarmNavigation();
	const can = useCan(environmentID);
	const client = useClientManager((s) => s.client);
	const [items, setItems] = useState<SwarmKeyValueItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [searchText, setSearchText] = useState('');
	const [pendingDelete, setPendingDelete] = useState<SwarmKeyValueItem>();
	const loading = useRef(false);
	const canManage = can(KeyValueKind.permission(kind));

	const load = useCallback(async () => {
		const current = useClientManager.getState().client;
		if (!current || loading.current) return;
		loading.current = true;
		setIsLoading(true);
		try {
			const list =
				kind === 'config'
					? await current.swarm.listConfigs({ envID: environmentID })
					: await current.swarm.listSecrets({ envID: environmentID });
			setItems(
				list.map((entry) => ({
					id: entry.id,
					spec: entry.spec,
					createdAt: entry.createdAt,
					updatedAt: entry.updatedAt
				}))
			);
			setErrorMessage(undefined);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			loading.current = false;
			setIsLoading(false);
		}
	}, [kind, environmentID]);

	useEffect(() => {
		void load();
	}, [load, client]);
	useOnChange(useSwarmVersion(environmentID), () => void load());

	const displayedItems = useMemo(() => {
		const query = searchText.trim().toLocaleLowerCase();
		return items
			.filter((item) => query === '' || itemName(item).toLocaleLowerCase().includes(query))
			.sort((a, b) => localizedStandardCompare(itemName(a), itemName(b)));
	}, [items, searchText]);

	const remove = async (item: SwarmKeyValueItem) => {
		try {
			if (!(await deleteItem(kind, item, environmentID))) return;
			setItems((current) => current.filter((entry) => entry.id !== item.id));
			swarmChanged(environmentID);
			showToast(Toasts.success(`${KeyValueKind.singular(kind)} deleted`));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	useItemDeleteConfirmation(pendingDelete, setPendingDelete, (item) => ({
		title: `Delete ${KeyValueKind.singular(kind)}`,
		message: `Delete “${itemName(item)}”? Services that use it must be updated first.`,
		icon: 'trash',
		actions: [{ title: 'Delete', action: () => void remove(item) }],
		dismissOnConfirm: false
	}));

	return {
		environmentID,
		kind,
		title: KeyValueKind.title(kind),
		items,
		displayedItems,
		isLoading,
		errorMessage,
		load,
		setSearchText,
		canManage,
		headerText: `${items.length} ${items.length === 1 ? KeyValueKind.singular(kind).toLowerCase() : KeyValueKind.title(kind).toLowerCase()}`,
		updatedText: (item: SwarmKeyValueItem) => `Updated ${swarmDate(item.updatedAt)}`,
		openDetail: (item: SwarmKeyValueItem) => swarm.openKeyValue(environmentID, kind, item),
		openCreate: () => swarm.openKeyValueCreate(environmentID, kind),
		requestDelete: (item: SwarmKeyValueItem) => setPendingDelete(item)
	};
}

export type SwarmKeyValuesModel = ReturnType<typeof useSwarmKeyValues>;

export function useSwarmKeyValueDetail() {
	const {
		id = '',
		envID = '0',
		kind: kindParam
	} = useLocalSearchParams<{ id?: string; envID?: string; kind?: string }>();
	const environmentID = envID;
	const kind = parseKind(kindParam);
	const can = useCan(environmentID);
	const [item] = useState(() =>
		screenCache.get<SwarmKeyValueItem>(swarmKeys.kvItem(environmentID, kind, id))
	);
	const [isDeleting, setIsDeleting] = useState(false);
	const canManage = can(KeyValueKind.permission(kind));

	const remove = async () => {
		if (!item) return;
		setIsDeleting(true);
		try {
			if (!(await deleteItem(kind, item, environmentID))) return;
			swarmChanged(environmentID);
			showToast(Toasts.success(`${KeyValueKind.singular(kind)} deleted`));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		} finally {
			setIsDeleting(false);
		}
	};

	const overflow: ActionButtonItem[] = canManage
		? [
				{
					id: 'delete',
					title: 'Delete',
					systemImage: 'trash',
					tint: systemColors.red,
					role: 'destructive',
					confirmationMessage: `Services that use this ${KeyValueKind.singular(kind).toLowerCase()} must be updated first.`,
					action: () => void remove()
				}
			]
		: [];

	return {
		kind,
		item,
		name: item ? itemName(item) : '',
		data: item && kind === 'config' ? decodedData(item) : undefined,
		createdText: item ? swarmDate(item.createdAt) : '',
		updatedText: item ? swarmDate(item.updatedAt) : '',
		canManage,
		toolbar: { overflow, runningItemID: isDeleting ? 'delete' : undefined, isDisabled: isDeleting }
	};
}

export type SwarmKeyValueDetailModel = ReturnType<typeof useSwarmKeyValueDetail>;

export function useSwarmKeyValueCreate() {
	const router = useRouter();
	const { envID = '0', kind: kindParam } = useLocalSearchParams<{
		envID?: string;
		kind?: string;
	}>();
	const environmentID = envID;
	const kind = parseKind(kindParam);
	const [name, setName] = useState('');
	const [data, setData] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const trimmedName = name.trim();
	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const create = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		const spec = { Name: trimmedName, Data: base64UTF8(data) };
		try {
			if (kind === 'config')
				await client.swarm.createConfig({ request: { spec }, envID: environmentID });
			else await client.swarm.createSecret({ request: { spec }, envID: environmentID });
			swarmChanged(environmentID);
			showToast(Toasts.success(`${KeyValueKind.singular(kind)} created`));
			dismiss();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	return {
		kind,
		name,
		setName,
		data,
		setData,
		isSaving,
		errorMessage,
		title: `Create ${KeyValueKind.singular(kind)}`,
		namePlaceholder: kind === 'config' ? 'nginx.conf' : 'db_password',
		footer: `${KeyValueKind.title(kind)} can't be changed after they're created.`,
		canCreate: !isSaving && trimmedName !== '' && data !== '',
		dismissDisabled: isSaving || data !== '',
		cancel: dismiss,
		create: () => void create()
	};
}

export type SwarmKeyValueCreateModel = ReturnType<typeof useSwarmKeyValueCreate>;
