import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useDebounced, useOnChange } from '@/features/containers/hooks';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { JobStatus } from '@/sdk/models/jobSchedule/JobSchedule';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentPagedList } from '@/stores/environment-paged-list';
import { useEnvironmentsStore } from '@/stores/environments-store';

import {
	copyJobName,
	copyJobSchedule,
	jobGroups,
	runJob,
	useRunningJobs,
	type JobItem
} from './job-model';
import { useJobsNavigation } from './jobs-routes';

export type JobsListProps = {
	environmentID: EnvironmentID;
	allEnvironments: boolean;
};

export function useJobsList({ environmentID, allEnvironments }: JobsListProps) {
	const [list, snapshot] = useEnvironmentPagedList<JobStatus>();
	const client = useClientManager((s) => s.client);
	const navigation = useJobsNavigation();
	const runningIDs = useRunningJobs((s) => s.ids);
	const [searchText, setSearchText] = useState('');
	const debouncedSearchText = useDebounced(searchText, 200);

	const load = useCallback(async () => {
		const current = useClientManager.getState().client;
		if (!current) return;
		const environments = await useEnvironmentsStore
			.getState()
			.listEnvironments(environmentID, allEnvironments);
		await list.reload(environments, async (envID) => {
			const jobs = (await current.jobs.list({ envID })).jobs;
			return {
				items: jobs,
				pagination: {
					totalPages: 1,
					totalItems: jobs.length,
					currentPage: 1,
					itemsPerPage: Math.max(jobs.length, 1)
				}
			};
		});
	}, [list, environmentID, allEnvironments]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);
	useOnChange(client, () => void load());

	const jobs = snapshot.items;
	const { groups, filteredCount } = useMemo(
		() => jobGroups(jobs, debouncedSearchText),
		[jobs, debouncedSearchText]
	);

	return {
		snapshot,
		jobs,
		groups,
		filteredJobCount: filteredCount,
		searchText,
		setSearchText,
		load,
		isRunning: (job: JobItem) => runningIDs.has(job.id),
		canRun: (job: JobItem) => !runningIDs.has(job.id) && job.value.enabled,
		run: (job: JobItem) => void runJob(job),
		copyName: (job: JobItem) => copyJobName(job.value),
		copySchedule: (job: JobItem) => copyJobSchedule(job.value),
		openDetail: (job: JobItem) => navigation.openDetail(job)
	};
}

export type JobsListModel = ReturnType<typeof useJobsList>;
