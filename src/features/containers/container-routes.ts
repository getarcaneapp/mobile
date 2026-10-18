import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { useTabStackGroup } from '@/features/navigation/tab-stack-group';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { ContainerDetails } from '@/sdk/models/container/ContainerDetails';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';

const containerKey = (environmentID: EnvironmentID, id: string) => `${environmentID}/${id}`;

const summaries = new Map<string, ContainerSummary>();
const details = new Map<string, ContainerDetails>();

export const containerCache = {
	setSummary: (environmentID: EnvironmentID, summary: ContainerSummary) =>
		summaries.set(containerKey(environmentID, summary.id), summary),
	summary: (environmentID: EnvironmentID, id: string) =>
		summaries.get(containerKey(environmentID, id)),
	setDetails: (environmentID: EnvironmentID, value: ContainerDetails) =>
		details.set(containerKey(environmentID, value.id), value),
	details: (environmentID: EnvironmentID, id: string) =>
		details.get(containerKey(environmentID, id))
};

const payloads = new Map<string, unknown>();
let nextToken = 0;

export const routePayloads = {
	put(this: void, value: unknown): string {
		const token = `p${Date.now().toString(36)}${nextToken++}`;
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

type Params = Record<string, string | undefined>;

function query(params: Params) {
	const entries = Object.entries(params).filter(
		(entry): entry is [string, string] => entry[1] !== undefined
	);
	return entries.length === 0
		? ''
		: `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export function useContainerNavigation() {
	const router = useRouter();
	const group = useTabStackGroup('(containers)');
	return useMemo(() => {
		const href = (path: string, params: Params = {}) =>
			`/(tabs)/${group}/${path}${query(params)}` as Href;
		const containerPath = (id: string, suffix = '') =>
			`container/${encodeURIComponent(id)}${suffix}`;
		return {
			router,
			openDetail: (
				environmentID: EnvironmentID,
				summary: ContainerSummary,
				environmentName?: string
			) => {
				containerCache.setSummary(environmentID, summary);
				router.push(
					href(containerPath(summary.id), { envID: environmentID, envName: environmentName })
				);
			},
			replaceDetail: (environmentID: EnvironmentID, id: string) => {
				router.replace(href(containerPath(id), { envID: environmentID }));
			},
			openLogs: (environmentID: EnvironmentID, id: string, title: string, storeToken?: string) => {
				router.push(
					href(containerPath(id, '/logs'), { envID: environmentID, title, store: storeToken })
				);
			},
			openTerminal: (environmentID: EnvironmentID, id: string, title: string) => {
				router.push(href(containerPath(id, '/terminal'), { envID: environmentID, title }));
			},
			openSubpage: (
				page: 'inspect' | 'rename' | 'commit' | 'env' | 'labels' | 'mounts' | 'health',
				environmentID: EnvironmentID,
				id: string,
				params: Params = {}
			) => {
				router.push(href(containerPath(id, `/${page}`), { envID: environmentID, ...params }));
			},
			openConfiguration: (
				environmentID: EnvironmentID,
				containerID: string | undefined,
				onSaved: (id: string) => boolean | void
			) => {
				router.push(
					href('container-configuration', {
						envID: environmentID,
						containerID,
						token: routePayloads.put(onSaved)
					})
				);
			},
			openCompose: (environmentID: EnvironmentID, containerIDs: string[]) => {
				router.push(
					href('containers-compose', { envID: environmentID, ids: containerIDs.join(',') })
				);
			},
			openFilter: (listKey: string) => {
				router.push(href('containers-filter', { key: listKey }));
			}
		};
	}, [router, group]);
}
