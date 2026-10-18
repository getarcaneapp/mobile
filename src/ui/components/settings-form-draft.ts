import { useEffect, useState } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';

import { friendlyErrorMessage } from '@/core/errors';
import { PaginationLoader } from '@/core/networking/pagination-loader';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { PublicSetting } from '@/sdk/models/settings/Settings';
import { showToast, Toasts } from '@/ui/toast';

import type { SettingFieldDef } from './settings-form.types';

export type EnvironmentSettingsDraftState = {
	environmentID: EnvironmentID;
	environmentName: string;
	values: Record<string, string>;
	original: Record<string, string>;
	hasLoaded: boolean;
	isLoading: boolean;
	isSaving: boolean;
	errorMessage: string | undefined;
	runningContainers: string[];
	networkNames: string[];

	setValue: (key: string, value: string) => void;
	load: (client: ArcaneClient, fields: SettingFieldDef[]) => Promise<void>;
	revert: () => void;
	save: (client: ArcaneClient, fields: SettingFieldDef[]) => Promise<boolean>;
};

export type EnvironmentSettingsDraft = StoreApi<EnvironmentSettingsDraftState>;

export function changedValues(
	state: Pick<EnvironmentSettingsDraftState, 'values' | 'original'>
): Record<string, string> {
	const changes: Record<string, string> = {};
	for (const [key, value] of Object.entries(state.values)) {
		if (state.original[key] !== value) changes[key] = value;
	}
	return changes;
}

export const draftHasChanges = (
	state: Pick<EnvironmentSettingsDraftState, 'values' | 'original'>
) => Object.keys(changedValues(state)).length > 0;

export function isFieldVisible(field: SettingFieldDef, values: Record<string, string>): boolean {
	const condition = field.visibleWhen;
	if (!condition) return true;
	return values[condition.key] === condition.value;
}

function validate(fields: SettingFieldDef[], values: Record<string, string>): string | undefined {
	for (const field of fields) {
		if (field.type.kind !== 'number') continue;
		const raw = (values[field.key] ?? '').trim();
		if (raw === '') continue;
		if (!/^[+-]?\d+$/.test(raw)) return `${field.label} must be a whole number.`;
		const number = parseInt(raw, 10);
		if (field.minValue !== undefined && number < field.minValue)
			return `${field.label} must be at least ${field.minValue}.`;
		if (field.maxValue !== undefined && number > field.maxValue)
			return `${field.label} must be at most ${field.maxValue}.`;
	}
	return undefined;
}

const containerDisplayName = (container: ContainerSummary) => {
	const first = (container.names[0] ?? '').replace(/^\/+|\/+$/g, '');
	return first === '' ? container.id.slice(0, 12) : first;
};

const localizedCompare = (a: string, b: string) =>
	a.localeCompare(b, undefined, { sensitivity: 'base' });

export function createEnvironmentSettingsDraft(
	environmentID: EnvironmentID,
	environmentName: string
): EnvironmentSettingsDraft {
	let loadGeneration = 0;

	return createStore<EnvironmentSettingsDraftState>((set, get) => {
		const loadContainers = async (client: ArcaneClient, generation: number) => {
			try {
				const list = await PaginationLoader.collect(async (start, limit) => {
					const response = await client.containers.list({
						envID: environmentID,
						query: { start, limit }
					});
					return { items: response.data, pagination: response.pagination };
				});
				if (generation !== loadGeneration) return;
				set({
					runningContainers: list
						.filter((container) => container.state.toLowerCase() === 'running')
						.map(containerDisplayName)
						.sort(localizedCompare)
				});
			} catch {}
		};

		const loadNetworks = async (client: ArcaneClient, generation: number) => {
			try {
				const networks = await PaginationLoader.collect(
					async (start, limit) => {
						const response = await client.networks.list({
							envID: environmentID,
							query: { start, limit }
						});
						return { items: response.data, pagination: response.pagination };
					},
					{ pageSize: 1_000 }
				);
				if (generation !== loadGeneration) return;
				const builtIn = new Set(['bridge', 'host', 'none']);
				set({
					networkNames: [
						...new Set(
							networks
								.map((network) => network.name)
								.filter((name) => name !== '' && !builtIn.has(name))
						)
					].sort(localizedCompare)
				});
			} catch {
				showToast(Toasts.info('Couldn’t load Docker networks. Showing built-in options only.'));
			}
		};

		return {
			environmentID,
			environmentName,
			values: {},
			original: {},
			hasLoaded: false,
			isLoading: false,
			isSaving: false,
			errorMessage: undefined,
			runningContainers: [],
			networkNames: [],

			setValue: (key, value) => set((state) => ({ values: { ...state.values, [key]: value } })),

			load: async (client, fields) => {
				const generation = ++loadGeneration;
				set({ isLoading: true, errorMessage: undefined });
				try {
					const settings: PublicSetting[] = await client.settings.getSettings({
						envID: environmentID
					});
					if (generation !== loadGeneration) return;
					const loaded: Record<string, string> = {};
					for (const setting of settings) loaded[setting.key] = setting.value;
					set({ values: loaded, original: { ...loaded }, hasLoaded: true });
				} catch (error) {
					if (generation !== loadGeneration) return;
					set({ errorMessage: friendlyErrorMessage(error) });
					return;
				} finally {
					if (generation === loadGeneration) set({ isLoading: false });
				}
				if (fields.some((field) => field.type.kind === 'containerMultiSelect'))
					await loadContainers(client, generation);
				if (fields.some((field) => field.type.kind === 'networkSelect'))
					await loadNetworks(client, generation);
			},

			revert: () => set((state) => ({ values: { ...state.original }, errorMessage: undefined })),

			save: async (client, fields) => {
				const validationError = validate(fields, get().values);
				if (validationError) {
					set({ errorMessage: validationError });
					return false;
				}
				const changes = changedValues(get());
				if (Object.keys(changes).length === 0) return true;
				set({ isSaving: true, errorMessage: undefined });
				try {
					await client.rest.put<PublicSetting[]>(
						client.rest.environmentPath(environmentID, 'settings'),
						{ body: changes }
					);
					set((state) => ({ original: { ...state.original, ...changes } }));
					return true;
				} catch (error) {
					set({ errorMessage: friendlyErrorMessage(error) });
					return false;
				} finally {
					set({ isSaving: false });
				}
			}
		};
	});
}

const drafts = new Map<string, EnvironmentSettingsDraft>();
let nextToken = 0;

export function registeredSettingsDraft(
	token: string | undefined
): EnvironmentSettingsDraft | undefined {
	return token ? drafts.get(token) : undefined;
}

function makeSettingsDraftEntry(environmentID: EnvironmentID, environmentName: string) {
	return {
		environmentID,
		draft: createEnvironmentSettingsDraft(environmentID, environmentName),
		token: `d${Date.now().toString(36)}${nextToken++}`
	};
}

export function useEnvironmentSettingsDraft(environmentID: EnvironmentID, environmentName: string) {
	const [entry, setEntry] = useState(() => makeSettingsDraftEntry(environmentID, environmentName));
	let current = entry;
	if (entry.environmentID !== environmentID) {
		current = makeSettingsDraftEntry(environmentID, environmentName);
		setEntry(current);
	}
	const { draft, token } = current;
	useEffect(() => {
		drafts.set(token, draft);
		return () => {
			drafts.delete(token);
		};
	}, [token, draft]);
	return { draft, token };
}

export function useDraft<T>(
	draft: EnvironmentSettingsDraft,
	selector: (state: EnvironmentSettingsDraftState) => T
): T {
	return useStore(draft, selector);
}
