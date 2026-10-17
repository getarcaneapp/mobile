/**
 * Port of `EnvironmentSettingsDraft` (EnvironmentSettingsForm.swift): one
 * environment's settings while they're being edited — loads the flat
 * key/value settings, tracks edits, and saves only what changed.
 *
 * Each draft is a vanilla zustand store owned by the screen that created it
 * (`useEnvironmentSettingsDraft`). Drafts register under a token so a pushed
 * screen (the excluded-containers picker) edits the same draft, like the
 * Swift `@Bindable` hand-off.
 */
import { useEffect, useMemo } from 'react';
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
	/** Running container display names for the exclusion pickers, sorted. */
	runningContainers: string[];
	networkNames: string[];

	setValue: (key: string, value: string) => void;
	load: (client: ArcaneClient, fields: SettingFieldDef[]) => Promise<void>;
	revert: () => void;
	/** Saves every changed key. Resolves false on validation or request failure. */
	save: (client: ArcaneClient, fields: SettingFieldDef[]) => Promise<boolean>;
};

export type EnvironmentSettingsDraft = StoreApi<EnvironmentSettingsDraftState>;

/** `changedValues`. */
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

/** `isVisible(_:)`. */
export function isFieldVisible(field: SettingFieldDef, values: Record<string, string>): boolean {
	const condition = field.visibleWhen;
	if (!condition) return true;
	return values[condition.key] === condition.value;
}

/** Validates numeric fields against their allowed range before saving. */
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
		/** Running containers for the exclusion pickers. Non-fatal on failure. */
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
			} catch {
				// Leave the picker showing already-excluded names.
			}
		};

		/** Docker networks for the Trivy network menu. Auto and the built-in modes stay valid if this fails. */
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
					// Settings are flat string pairs server-side, so the raw dictionary is sent.
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

// MARK: - Registry

const drafts = new Map<string, EnvironmentSettingsDraft>();
let nextToken = 0;

/** Looks up a draft registered by `useEnvironmentSettingsDraft` (for pushed screens). */
export function registeredSettingsDraft(
	token: string | undefined
): EnvironmentSettingsDraft | undefined {
	return token ? drafts.get(token) : undefined;
}

/**
 * `@State private var draft = EnvironmentSettingsDraft(...)`: one draft for
 * the screen's lifetime, registered under `token` while mounted.
 */
export function useEnvironmentSettingsDraft(environmentID: EnvironmentID, environmentName: string) {
	const { draft, token } = useMemo(
		() => ({
			draft: createEnvironmentSettingsDraft(environmentID, environmentName),
			token: `d${Date.now().toString(36)}${nextToken++}`
		}),
		// A new environment starts a new draft; the name is display-only.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[environmentID]
	);
	useEffect(() => {
		drafts.set(token, draft);
		return () => {
			drafts.delete(token);
		};
	}, [token, draft]);
	return { draft, token };
}

/** Subscribes to a slice of a draft. */
export function useDraft<T>(
	draft: EnvironmentSettingsDraft,
	selector: (state: EnvironmentSettingsDraftState) => T
): T {
	return useStore(draft, selector);
}
