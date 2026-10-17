/**
 * Shared model for `SettingsCategoryView` (EnvironmentSettingsForm.swift):
 * loads a server-wide settings category from the local environment (by
 * default), tracks edits through an `EnvironmentSettingsDraft`, and saves.
 */
import { useCallback, useEffect } from 'react';

import { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { draftHasChanges, useDraft, useEnvironmentSettingsDraft } from './settings-form-draft';
import { categoryFields, type SettingsCategoryDef } from './settings-form.types';

export function useSettingsCategory(
	category: SettingsCategoryDef,
	environmentID: string = EnvironmentID.localDocker,
	environmentName = ''
) {
	const { draft, token } = useEnvironmentSettingsDraft(environmentID, environmentName);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const hasChanges = useDraft(draft, draftHasChanges);
	const isSaving = useDraft(draft, (s) => s.isSaving);
	const isLoading = useDraft(draft, (s) => s.isLoading);
	const hasLoaded = useDraft(draft, (s) => s.hasLoaded);

	const load = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		await draft.getState().load(client, categoryFields(category));
	}, [draft, category]);

	// `.task { await load() }`
	useEffect(() => {
		void load();
	}, [load, clientGeneration]);

	const save = useCallback(() => {
		void (async () => {
			const client = useClientManager.getState().client;
			if (!client) return;
			if (await draft.getState().save(client, categoryFields(category)))
				showToast(Toasts.success('Settings saved'));
		})();
	}, [draft, category]);

	const revert = useCallback(() => draft.getState().revert(), [draft]);

	return {
		draft,
		draftToken: token,
		hasChanges,
		isSaving,
		isLoading,
		hasLoaded,
		load,
		save,
		revert
	};
}
