/**
 * Routes and payloads for the generic backend-resource screens
 * (DynamicResourceViews.swift). SwiftUI pushes these with closures
 * (`NavigationLink { DynamicResourceDetailView(...) }`, `.sheet { DynamicCreateFormView(...) }`);
 * here the closures travel through `settingsPayloads`.
 */
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

/** Everything `DynamicResourceDetailView` is initialised with. */
export interface DynamicResourceDetailPayload {
	title: string;
	resource: DynamicResource;
	actions: BackendListAction[];
	/** The list endpoint (without query) that `/`-prefixed action suffixes extend. */
	basePath?: string;
	edit?: DynamicEditConfig;
	onChange: () => void;
}

/** Everything `DynamicCreateFormView` is initialised with. */
export interface DynamicFormPayload {
	title: string;
	fields: BackendFormField[];
	/** Edit mode: seeds the form from the resource. */
	initial?: DynamicResource;
	/** Receives the JSON body; throwing keeps the sheet open with the error shown. */
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

/** Reads a pushed screen's payload once, from its `token` route param. */
export function useRoutePayload<T>(): T | undefined {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => settingsPayloads.get<T>(token));
	return payload;
}
