import { useCallback, useEffect, useState } from 'react';
import { useStore } from 'zustand';

import type { Template } from '@/sdk/models/template/Template';
import { useClientManager } from '@/stores/client-manager';
import {
	createTemplateBrowserStore,
	templateBrowserQueryKey,
	TemplateSourceSelection
} from '@/stores/template-browser-store';
import { systemColors } from '@/theme/colors';
import type { ScrollableTabOption } from '@/ui/components/scrollable-tab-bar.types';

import { useTemplatePermissions } from './template-permissions';
import { useTemplateNavigation } from './template-routes';

export type TemplateGroup = { name: string; templates: Template[] };

export function templateSourceTint(source: TemplateSourceSelection): string {
	switch (source) {
		case 'all':
			return systemColors.purple;
		case 'local':
			return systemColors.green;
		case 'remote':
			return systemColors.blue;
	}
}

export const templateSourceOptions: ScrollableTabOption<TemplateSourceSelection>[] =
	TemplateSourceSelection.allCases.map((source) => ({
		value: source,
		title: TemplateSourceSelection.title(source),
		systemImage: TemplateSourceSelection.icon(source),
		tint: templateSourceTint(source)
	}));

export function groupTemplates(templates: Template[]): TemplateGroup[] {
	const groups = new Map<string, Template[]>();
	for (const template of templates) {
		const key = template.registry?.name ?? (template.isRemote ? 'Remote' : 'Local');
		const group = groups.get(key);
		if (group) group.push(template);
		else groups.set(key, [template]);
	}
	return [...groups.keys()]
		.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
		.map((name) => ({ name, templates: groups.get(name) ?? [] }));
}

export function useTemplateBrowser({ embedded = false }: { embedded?: boolean } = {}) {
	const client = useClientManager((s) => s.client);
	const permissions = useTemplatePermissions();
	const navigation = useTemplateNavigation();
	const [store] = useState(createTemplateBrowserStore);
	const state = useStore(store);
	const queryKey = templateBrowserQueryKey(state);
	const canListTemplates = permissions.canList;

	useEffect(() => {
		if (!canListTemplates) return;
		store.getState().configure(client);
		const timer = setTimeout(() => void store.getState().reload({ clearExisting: true }), 350);
		return () => clearTimeout(timer);
	}, [store, client, queryKey, canListTemplates]);

	const reload = useCallback(() => store.getState().reload(), [store]);

	const refresh = useCallback(async () => {
		if (!canListTemplates) return;
		await store.getState().reload();
	}, [store, canListTemplates]);

	const groupedTemplates = groupTemplates(state.templates);

	return {
		embedded,
		permissions,
		canListTemplates,
		canReadTemplates: permissions.canRead,
		templates: state.templates,
		isLoading: state.isLoading,
		hasMore: state.hasMore,
		totalItemCount: state.totalItemCount,
		errorMessage: state.errorMessage,
		loadMoreError: state.loadMoreError,
		source: state.source,
		setSource: state.setSource,
		setSearchText: state.setSearchText,
		isUnfiltered: queryKey === '|all',
		groupedTemplates,
		reload,
		refresh,
		loadMore: () => void store.getState().loadMore(),
		openPreview: (template: Template) => navigation.openPreview({ template, onChange: reload }),
		openCreate: () => navigation.openEditor({ mode: { kind: 'create' }, onSuccess: reload }),
		openDefaults: () => navigation.openEditor({ mode: { kind: 'defaults' }, onSuccess: reload }),
		openRegistries: navigation.openRegistries,
		done: navigation.back
	};
}

export type TemplateBrowserModel = ReturnType<typeof useTemplateBrowser>;
