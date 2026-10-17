/**
 * Navigation for the Templates screens (TemplateBrowserView's NavigationLinks
 * and sheets). Routes live under `settings/templates/` in the shared tab group,
 * so pushes stay in the current tab stack; callbacks and loaded models travel
 * through `settingsPayloads`.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import type { Template, TemplateRegistry } from '@/sdk/models/template/Template';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';

/** Port of `TemplateEditorMode`. */
export type TemplateEditorMode =
	| { kind: 'create' }
	| { kind: 'edit'; template: Template }
	| { kind: 'defaults' };

export type TemplatePreviewPayload = { template: Template; onChange: () => Promise<void> };
export type TemplateEditorPayload = { mode: TemplateEditorMode; onSuccess: () => Promise<void> };
export type TemplateRegistryFormPayload = {
	registry?: TemplateRegistry;
	onSuccess: () => Promise<void>;
};

export function useTemplateNavigation() {
	const navigation = useSettingsNavigation();
	return useMemo(
		() => ({
			...navigation,
			openPreview(this: void, payload: TemplatePreviewPayload) {
				navigation.push('settings/templates/preview', {
					id: payload.template.id,
					token: settingsPayloads.put(payload)
				});
			},
			openRegistries(this: void) {
				navigation.push('settings/templates/registries');
			},
			openEditor(this: void, payload: TemplateEditorPayload) {
				navigation.push('settings/templates/editor', { token: settingsPayloads.put(payload) });
			},
			openRegistryForm(this: void, payload: TemplateRegistryFormPayload) {
				navigation.push('settings/templates/registry-form', {
					token: settingsPayloads.put(payload)
				});
			}
		}),
		[navigation]
	);
}

/** Reads (once) and later releases the payload a templates route was pushed with. */
export function useRoutePayload<T>(): {
	payload: T | undefined;
	params: Record<string, string | undefined>;
} {
	const params = useLocalSearchParams<Record<string, string>>();
	const token = params.token;
	const [payload] = useState(() => settingsPayloads.get<T>(token));
	useEffect(() => () => settingsPayloads.delete(token), [token]);
	return { payload, params };
}
