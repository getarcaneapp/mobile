import { useMemo } from 'react';

import { useClientManager } from '@/stores/client-manager';

import { CachedClient } from './cached-client';
import { serverCacheIdentity } from './server-identity';

type CachedClientSource = {
	client: CachedClient['client'] | undefined;
	parsedServerURL: string | undefined;
	serverURL: string;
	userID: string | undefined;
	cacheSessionIdentity: string;
};

function makeCachedClient(source: CachedClientSource): CachedClient | undefined {
	if (!source.client) return undefined;
	const url = source.parsedServerURL ?? source.serverURL;
	return new CachedClient(
		source.client,
		url ? serverCacheIdentity(url) : source.serverURL,
		source.userID ?? 'anon',
		source.cacheSessionIdentity
	);
}

export function cachedClient(): CachedClient | undefined {
	const s = useClientManager.getState();
	return makeCachedClient({
		client: s.client,
		parsedServerURL: s.parsedServerURL,
		serverURL: s.serverURL,
		userID: s.currentUser?.id,
		cacheSessionIdentity: s.cacheSessionIdentity
	});
}

export function useCachedClient(): CachedClient | undefined {
	const client = useClientManager((s) => s.client);
	const parsedServerURL = useClientManager((s) => s.parsedServerURL);
	const serverURL = useClientManager((s) => s.serverURL);
	const userID = useClientManager((s) => s.currentUser?.id);
	const cacheSessionIdentity = useClientManager((s) => s.cacheSessionIdentity);
	return useMemo(
		() => makeCachedClient({ client, parsedServerURL, serverURL, userID, cacheSessionIdentity }),
		[client, parsedServerURL, serverURL, userID, cacheSessionIdentity]
	);
}
