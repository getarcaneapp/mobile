import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { useTabStackGroup } from '@/features/navigation/tab-stack-group';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { AutoUpdateRecord } from '@/sdk/models/updater/Updater';

const records = new Map<string, AutoUpdateRecord>();

export const updaterHistoryRecords = {
	get: (key: string | undefined) => (key ? records.get(key) : undefined)
};

function recordKey(environmentID: EnvironmentID, record: AutoUpdateRecord) {
	return `${environmentID}/${record.id}`;
}

export function useUpdatesNavigation() {
	const router = useRouter();
	const group = useTabStackGroup('(updates)');
	return useMemo(() => {
		const href = (path: string, params: Record<string, string>) =>
			`/(tabs)/${group}/${path}?${Object.entries(params)
				.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
				.join('&')}` as Href;
		return {
			router,
			openHistory(environmentID: EnvironmentID) {
				router.push(href('updater-history', { envID: environmentID }));
			},
			openHistoryRecord(environmentID: EnvironmentID, record: AutoUpdateRecord) {
				const key = recordKey(environmentID, record);
				records.set(key, record);
				router.push(href('updater-history-record', { key, title: record.resourceName }));
			}
		};
	}, [router, group]);
}
