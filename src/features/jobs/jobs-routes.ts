import { useRouter, useSegments, type Href } from 'expo-router';
import { useMemo } from 'react';

import type { EnvironmentID } from '@/sdk/client/environment';

import { jobItemCache, type JobItem } from './job-model';

type Params = Record<string, string | undefined>;

function query(params: Params) {
	const entries = Object.entries(params).filter(
		(entry): entry is [string, string] => entry[1] !== undefined
	);
	return entries.length === 0
		? ''
		: `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export function useJobsNavigation() {
	const router = useRouter();
	const segments = useSegments() as string[];
	const group =
		segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(more)';
	return useMemo(() => {
		const href = (path: string, params: Params = {}) =>
			`/(tabs)/${group}/${path}${query(params)}` as Href;
		return {
			openList(environmentID: EnvironmentID, allEnvironments: boolean) {
				router.push(
					href('jobs-list', { envID: environmentID, all: allEnvironments ? '1' : undefined })
				);
			},
			openSchedules(environmentID: EnvironmentID, environmentName?: string) {
				router.push(href('job-schedules', { envID: environmentID, envName: environmentName }));
			},
			openScheduleEnvironments() {
				router.push(href('job-schedule-environments'));
			},
			openDetail(item: JobItem) {
				jobItemCache.set(item);
				router.push(
					href(`job/${encodeURIComponent(item.value.id)}`, {
						envID: item.environmentID,
						envName: item.environmentName
					})
				);
			}
		};
	}, [router, group]);
}
