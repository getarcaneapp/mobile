import { useCallback, useEffect, useRef } from 'react';

import type { Identifiable } from '@/core/networking/pagination-loader';
import type { ArcaneClient } from '@/sdk';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { PaginatedResponse } from '@/sdk/pagination/PaginatedResponse';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentPagedList, type EnvironmentFetch } from '@/stores/environment-paged-list';

import { useOnChange } from '@/features/containers/hooks';

import { useSwarmVersion } from './swarm-common';

export type SwarmPageFetcher<Value> = (
	client: ArcaneClient,
	args: { envID: EnvironmentID; search?: string; start: number; limit: number }
) => Promise<PaginatedResponse<Value>>;

export function useSwarmPagedList<Value extends Identifiable>(
	environmentID: EnvironmentID,
	fetcher: SwarmPageFetcher<Value>,
	search = ''
) {
	const client = useClientManager((s) => s.client);
	const [list, snapshot] = useEnvironmentPagedList<Value>(50);
	const latest = useRef({ fetcher, search });
	latest.current = { fetcher, search };

	const fetch = useCallback((): EnvironmentFetch<Value> | undefined => {
		const current = useClientManager.getState().client;
		if (!current) return undefined;
		const { fetcher: fetchPage, search: query } = latest.current;
		return async (envID, start, limit) => {
			const response = await fetchPage(current, {
				envID,
				search: query === '' ? undefined : query,
				start,
				limit
			});
			return { items: response.data, pagination: response.pagination };
		};
	}, []);

	const load = useCallback(async () => {
		const f = fetch();
		if (f) await list.reload([{ id: environmentID }], f);
	}, [fetch, list, environmentID]);

	const loadMore = useCallback(async () => {
		const f = fetch();
		if (f) await list.loadMore(f);
	}, [fetch, list]);

	useEffect(() => {
		void load();
	}, [load, client]);
	useOnChange(search, () => void load());
	useOnChange(useSwarmVersion(environmentID), () => void load());

	return { list, snapshot, items: snapshot.items, load, loadMore };
}
