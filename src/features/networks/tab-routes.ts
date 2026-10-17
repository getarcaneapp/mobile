import { useRouter, useSegments, type Href } from 'expo-router';
import { useMemo } from 'react';

export { routePayloads } from '@/features/containers/container-routes';

type Params = Record<string, string | undefined>;

function query(params: Params) {
	const entries = Object.entries(params).filter(
		(entry): entry is [string, string] => entry[1] !== undefined
	);
	return entries.length === 0
		? ''
		: `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

const values = new Map<string, unknown>();

export const screenCache = {
	set<T>(key: string, value: T) {
		values.set(key, value);
	},
	get<T>(key: string): T | undefined {
		return values.get(key) as T | undefined;
	}
};

export function useTabRouter() {
	const router = useRouter();
	const segments = useSegments() as string[];
	const group =
		segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(more)';
	return useMemo(() => {
		const href = (path: string, params: Params = {}) =>
			`/(tabs)/${group}/${path}${query(params)}` as Href;
		return {
			router,
			href,
			push: (path: string, params: Params = {}) => router.push(href(path, params)),
			back: () => {
				if (router.canGoBack()) router.back();
			}
		};
	}, [router, group]);
}

export type TabRouter = ReturnType<typeof useTabRouter>;

export const encodeSegment = (value: string) => encodeURIComponent(value);
