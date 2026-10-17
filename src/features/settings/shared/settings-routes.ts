/**
 * Navigation for the Settings / Customize destinations. Every route lives once
 * in the shared tab group, so pushes stay in whichever tab stack is current
 * (Swift: `NavigationLink` / `.sheet` on the presenting stack).
 *
 * Sub-routes live under `settings/…` in
 * `src/app/(tabs)/(dashboard,…,more)/settings/`. Objects that can't travel as
 * route params (a loaded model, an `onSaved` callback) are handed over through
 * `settingsPayloads`.
 */
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';

import { useTabStackGroup } from '@/features/navigation/tab-stack-group';

const payloads = new Map<string, unknown>();
let nextToken = 0;

/** One-shot hand-off of non-serializable values to a pushed route. */
export const settingsPayloads = {
	put(this: void, value: unknown): string {
		const token = `s${Date.now().toString(36)}${nextToken++}`;
		payloads.set(token, value);
		return token;
	},
	get<T>(this: void, token: string | undefined): T | undefined {
		return token ? (payloads.get(token) as T | undefined) : undefined;
	},
	delete(this: void, token: string | undefined) {
		if (token) payloads.delete(token);
	}
};

export type RouteParams = Record<string, string | undefined>;

function query(params: RouteParams) {
	const entries = Object.entries(params).filter(
		(entry): entry is [string, string] => entry[1] !== undefined
	);
	return entries.length === 0
		? ''
		: `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

/** Routes relative to the current tab's stack. */
export function useSettingsNavigation() {
	const router = useRouter();
	const group = useTabStackGroup();
	return useMemo(() => {
		const href = (path: string, params: RouteParams = {}) =>
			`/(tabs)/${group}/${path}${query(params)}` as Href;
		return {
			router,
			href,
			/** Push `path` (e.g. `"settings/users/abc"`, `"app-settings"`) onto the current stack. */
			push(this: void, path: string, params: RouteParams = {}) {
				router.push(href(path, params));
			},
			back(this: void) {
				if (router.canGoBack()) router.back();
			}
		};
	}, [router, group]);
}
