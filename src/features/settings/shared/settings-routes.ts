import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';

import { useTabStackGroup } from '@/features/navigation/tab-stack-group';

const payloads = new Map<string, unknown>();
let nextToken = 0;

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

export function useSettingsNavigation() {
	const router = useRouter();
	const group = useTabStackGroup();
	return useMemo(() => {
		const href = (path: string, params: RouteParams = {}) =>
			`/(tabs)/${group}/${path}${query(params)}` as Href;
		return {
			router,
			href,
			push(this: void, path: string, params: RouteParams = {}) {
				router.push(href(path, params));
			},
			back(this: void) {
				if (router.canGoBack()) router.back();
			}
		};
	}, [router, group]);
}
