/** Draft state + save for `RegistryFormView` (RegistryFormView.swift), shared by both platforms. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type {
	ContainerRegistry,
	CreateContainerRegistry,
	UpdateContainerRegistry
} from '@/sdk/models/containerRegistry/ContainerRegistry';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads } from '../shared/settings-routes';

export type RegistryFormPayload = { registry?: ContainerRegistry; onSuccess: () => Promise<void> };

/** Swift `StableStringRow`: an editable string with a stable identity. */
export type StableStringRow = { id: string; value: string };

let nextRowID = 0;
const makeRow = (value = ''): StableStringRow => ({ id: `row-${nextRowID++}`, value });

const nilIfEmpty = (value: string) => (value === '' ? undefined : value);

/** `registryRepositoryNames(rows:supported:)`. */
export function registryRepositoryNames(
	rows: StableStringRow[],
	supported: boolean
): string[] | undefined {
	if (!supported) return undefined;
	return rows.map((row) => row.value.trim()).filter((value) => value !== '');
}

type Draft = {
	url: string;
	username: string;
	token: string;
	description: string;
	enabled: boolean;
	insecure: boolean;
	registryType: string;
	awsAccessKeyId: string;
	awsSecretAccessKey: string;
	awsRegion: string;
	repositoryNameRows: StableStringRow[];
};

function populate(registry: ContainerRegistry | undefined): Draft {
	if (!registry) {
		return {
			url: '',
			username: '',
			token: '',
			description: '',
			enabled: true,
			insecure: false,
			registryType: 'generic',
			awsAccessKeyId: '',
			awsSecretAccessKey: '',
			awsRegion: '',
			repositoryNameRows: []
		};
	}
	return {
		url: registry.url,
		username: registry.username,
		token: '',
		description: registry.description ?? '',
		enabled: registry.enabled,
		insecure: registry.insecure,
		registryType: registry.registryType,
		awsAccessKeyId: registry.awsAccessKeyId ?? '',
		awsSecretAccessKey: '',
		awsRegion: registry.awsRegion ?? '',
		repositoryNameRows: registry.repositoryNames.map((name) => makeRow(name))
	};
}

const arraysEqual = (lhs: string[], rhs: string[]) =>
	lhs.length === rhs.length && lhs.every((value, index) => value === rhs[index]);

export function useRegistryForm() {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const router = useRouter();
	const [payload] = useState(() => settingsPayloads.get<RegistryFormPayload>(token));
	useEffect(() => () => settingsPayloads.delete(token), [token]);

	const client = useClientManager((s) => s.client);
	const supportsPost26 = useClientManager((s) => s.supportsPost26MobileFeatures);
	const registry = payload?.registry;
	const isEditing = registry !== undefined;

	const [draft, setDraft] = useState<Draft>(() => populate(registry));
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
	const updateRows = (transform: (rows: StableStringRow[]) => StableStringRow[]) =>
		setDraft((current) => ({
			...current,
			repositoryNameRows: transform(current.repositoryNameRows)
		}));
	const isAWS = draft.registryType === 'ecr';
	// Picker selects between generic and ecr; legacy "custom" maps to generic.
	const typeSelection: 'generic' | 'ecr' = isAWS ? 'ecr' : 'generic';

	const repositoryNames = draft.repositoryNameRows
		.map((row) => row.value.trim())
		.filter((value) => value !== '');

	const hasChanges = (() => {
		if (!registry) {
			return (
				draft.url !== '' ||
				draft.username !== '' ||
				draft.token !== '' ||
				draft.description !== '' ||
				!draft.enabled ||
				draft.insecure ||
				typeSelection !== 'generic' ||
				draft.awsAccessKeyId !== '' ||
				draft.awsSecretAccessKey !== '' ||
				draft.awsRegion !== '' ||
				draft.repositoryNameRows.length > 0
			);
		}
		const typeMatch =
			draft.registryType === registry.registryType ||
			(typeSelection === 'generic' &&
				(registry.registryType === 'generic' || registry.registryType === 'custom'));
		return (
			draft.url !== registry.url ||
			draft.username !== registry.username ||
			draft.description !== (registry.description ?? '') ||
			draft.enabled !== registry.enabled ||
			draft.insecure !== registry.insecure ||
			!typeMatch ||
			draft.awsAccessKeyId !== (registry.awsAccessKeyId ?? '') ||
			draft.awsRegion !== (registry.awsRegion ?? '') ||
			draft.token !== '' ||
			draft.awsSecretAccessKey !== '' ||
			(supportsPost26 && !arraysEqual(repositoryNames, registry.repositoryNames))
		);
	})();

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const revertChanges = () => {
		setDraft(populate(registry));
		setErrorMessage(undefined);
	};

	const saveRegistry = async () => {
		if (!client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		try {
			const names = registryRepositoryNames(draft.repositoryNameRows, supportsPost26);
			if (registry) {
				const body: UpdateContainerRegistry = {
					url: draft.url,
					username: nilIfEmpty(draft.username),
					token: nilIfEmpty(draft.token),
					description: nilIfEmpty(draft.description),
					insecure: draft.insecure,
					enabled: draft.enabled,
					registryType: nilIfEmpty(draft.registryType),
					awsAccessKeyId: nilIfEmpty(draft.awsAccessKeyId),
					awsSecretAccessKey: nilIfEmpty(draft.awsSecretAccessKey),
					awsRegion: nilIfEmpty(draft.awsRegion),
					repositoryNames: names
				};
				await client.registries.update({ id: registry.id, body });
			} else {
				const body: CreateContainerRegistry = {
					url: draft.url,
					username: draft.username,
					token: draft.token,
					description: nilIfEmpty(draft.description),
					insecure: draft.insecure,
					enabled: draft.enabled,
					registryType: draft.registryType === '' ? 'custom' : draft.registryType,
					awsAccessKeyId: draft.awsAccessKeyId,
					awsSecretAccessKey: draft.awsSecretAccessKey,
					awsRegion: draft.awsRegion,
					repositoryNames: names
				};
				await client.registries.create({ body });
			}
			showToast(Toasts.success(registry === undefined ? 'Registry created' : 'Registry updated'));
			await payload?.onSuccess();
			dismiss();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsLoading(false);
		}
	};

	return {
		draft,
		update,
		isEditing,
		isAWS,
		typeSelection,
		setType: (value: 'generic' | 'ecr') => update({ registryType: value }),
		supportsPost26,
		hasChanges,
		canSave: draft.url !== '',
		isLoading,
		errorMessage,
		title: isEditing ? 'Edit Registry' : 'Add Registry',
		saveAccessibilityLabel: isEditing ? 'Save' : 'Add',
		addRepositoryRow: () => updateRows((rows) => [...rows, makeRow()]),
		updateRepositoryRow: (id: string, value: string) =>
			updateRows((rows) => rows.map((row) => (row.id === id ? { ...row, value } : row))),
		removeRepositoryRow: (id: string) => updateRows((rows) => rows.filter((row) => row.id !== id)),
		save: () => void saveRegistry(),
		revertChanges,
		cancel: dismiss
	};
}

export type RegistryFormModel = ReturnType<typeof useRegistryForm>;
