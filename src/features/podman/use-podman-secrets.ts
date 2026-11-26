import { useAdvancedFeatures } from '@/core/advanced-features';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { PodmanSecret } from '@/sdk/models/podman/PodmanSecret';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { useDebounced } from '@/features/containers/hooks';

import { podmanChanged, podmanDate, usePodmanCan } from './podman-common';
import { usePodmanNavigation } from './podman-routes';
import type { PodmanMenuAction } from './podman-parts.types';
import { usePodmanPagedList } from './use-podman-list';

async function removeSecret(environmentID: EnvironmentID, secret: PodmanSecret) {
	const client = useClientManager.getState().client;
	if (!client) return false;
	try {
		await client.podman.removeSecret({ secretId: secret.id, envID: environmentID });
		podmanChanged(environmentID);
		showToast(Toasts.success('Secret removed'));
		return true;
	} catch (error) {
		showToast(Toasts.error(friendlyErrorMessage(error)));
		return false;
	}
}

export function usePodmanSecrets() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const environmentID = envID;
	const podman = usePodmanNavigation();
	const can = usePodmanCan(environmentID);
	const [advanced] = useAdvancedFeatures();
	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);
	const [pendingDelete, setPendingDelete] = useState<PodmanSecret>();
	const paged = usePodmanPagedList<PodmanSecret>(
		environmentID,
		(client, args) => client.podman.listSecrets(args),
		debouncedSearch
	);
	const canCreate = can(Permission.Podman.secretsCreate) && advanced;
	const canUpdate = can(Permission.Podman.secretsUpdate) && advanced;
	const canDelete = can(Permission.Podman.secretsDelete);

	useItemDeleteConfirmation(pendingDelete, setPendingDelete, (secret) => ({
		title: 'Remove Secret',
		message: `Remove “${secret.name}”? Containers that use it must be recreated first.`,
		icon: 'trash',
		actions: [
			{
				title: 'Remove',
				action: () =>
					void removeSecret(environmentID, secret).then((removed) => {
						if (removed)
							paged.list.updateItems((items) =>
								items.filter((item) => item.value.id !== secret.id)
							);
					})
			}
		],
		dismissOnConfirm: false
	}));

	const menuActions = (secret: PodmanSecret): PodmanMenuAction[] => {
		const actions: PodmanMenuAction[] = [];
		if (canUpdate)
			actions.push({
				id: 'replace',
				title: 'Replace Value',
				systemImage: 'pencil',
				onPress: () => podman.openSecretForm(environmentID, secret.name)
			});
		if (canDelete)
			actions.push({
				id: 'remove',
				title: 'Remove',
				systemImage: 'trash',
				destructive: true,
				onPress: () => setPendingDelete(secret)
			});
		return actions;
	};

	return {
		...paged,
		environmentID,
		setSearchText,
		emptyTitle: debouncedSearch === '' ? 'No Secrets' : 'No Results',
		canCreate,
		canDelete,
		menuActions,
		subtitle: (secret: PodmanSecret) =>
			`${secret.driver} · Updated ${podmanDate(secret.updatedAt || secret.createdAt)}`,
		openCreate: () => podman.openSecretForm(environmentID),
		requestDelete: (secret: PodmanSecret) => setPendingDelete(secret)
	};
}

export type PodmanSecretsModel = ReturnType<typeof usePodmanSecrets>;

async function saveSecret(
	environmentID: EnvironmentID,
	existingName: string | undefined,
	input: { name: string; data: string; driver: string }
) {
	const client = useClientManager.getState().client;
	if (!client) return false;
	const driver = input.driver === '' ? undefined : input.driver;
	const isReplacing = existingName !== undefined && existingName !== '';
	if (isReplacing)
		await client.podman.updateSecret({
			name: existingName,
			request: { data: input.data, driver },
			envID: environmentID
		});
	else
		await client.podman.createSecret({
			request: { name: input.name, data: input.data, driver },
			envID: environmentID
		});
	podmanChanged(environmentID);
	showToast(Toasts.success(isReplacing ? 'Secret replaced' : 'Secret created'));
	return true;
}

export function usePodmanSecretForm() {
	const router = useRouter();
	const { envID = '0', name: existingName } = useLocalSearchParams<{
		envID?: string;
		name?: string;
	}>();
	const environmentID = envID;
	const isReplacing = existingName !== undefined && existingName !== '';
	const [name, setName] = useState(isReplacing ? existingName : '');
	const [data, setData] = useState('');
	const [driver, setDriver] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const trimmedName = name.trim();
	const trimmedDriver = driver.trim();

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const save = async () => {
		setIsSaving(true);
		setErrorMessage(undefined);
		const request = { name: trimmedName, data, driver: trimmedDriver };
		await withCleanup(
			async () => {
				try {
					if (await saveSecret(environmentID, existingName, request)) dismiss();
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsSaving(false)
		);
	};

	return {
		isReplacing,
		title: isReplacing ? `Replace ${existingName}` : 'Create Secret',
		saveTitle: isReplacing ? 'Replace' : 'Create',
		name,
		setName,
		data,
		setData,
		driver,
		setDriver,
		isSaving,
		errorMessage,
		footer: "Podman can't show secret values after they're stored.",
		canSave: !isSaving && data !== '' && (isReplacing || trimmedName !== ''),
		dismissDisabled: isSaving || data !== '',
		cancel: dismiss,
		save: () => void save()
	};
}

export type PodmanSecretFormModel = ReturnType<typeof usePodmanSecretForm>;
