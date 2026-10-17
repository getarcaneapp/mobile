import { useLocalSearchParams } from 'expo-router';

import type { PortMapping } from '@/sdk/models/port/PortMapping';

import { screenCache } from '@/features/networks/tab-routes';

import { hostString, portCacheKey } from './use-ports-list';

export function usePortDetail() {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const port = screenCache.get<PortMapping>(portCacheKey(envID, id));
	return { port, hostString: port ? hostString(port) : '' };
}
