import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import {
	settingsPayloads,
	useSettingsNavigation
} from '@/features/settings/shared/settings-routes';

import type {
	BackendFormField,
	BackendListAction,
	DynamicEditConfig,
	DynamicResource
} from './dynamic-resource';

export const DynamicResourceRoutes = {
	detail: 'settings/customize/resource',
	form: 'settings/customize/resource-form'
} as const;

export interface DynamicResourceDetailPayload {
	title: string;
	resource: DynamicResource;
	actions: BackendListAction[];
	basePath?: string;
	edit?: DynamicEditConfig;
	onChange: () => void;
}

export interface DynamicFormPayload {
	title: string;
	fields: BackendFormField[];
	initial?: DynamicResource;
	onSubmit: (body: Record<string, unknown>) => Promise<void>;
}

export function useDynamicResourceNavigation() {
	const nav = useSettingsNavigation();
	return {
		...nav,
		openDetail(payload: DynamicResourceDetailPayload) {
			nav.push(DynamicResourceRoutes.detail, { token: settingsPayloads.put(payload) });
		},
		openForm(payload: DynamicFormPayload) {
			nav.push(DynamicResourceRoutes.form, { token: settingsPayloads.put(payload) });
		}
	};
}

export function useRoutePayload<T>(): T | undefined {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => settingsPayloads.get<T>(token));
	return payload;
}
