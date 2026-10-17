import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { useClientManager } from '@/stores/client-manager';

import { jobItemCache, runJob, useRunningJobs, type JobItem } from './job-model';

export function useJobDetail() {
	const {
		id = '',
		envID = '0',
		envName
	} = useLocalSearchParams<{ id?: string; envID?: string; envName?: string }>();
	const [item, setItem] = useState<JobItem | undefined>(() => jobItemCache.get(envID, id));
	const [errorMessage, setErrorMessage] = useState<string>();
	const isRunning = useRunningJobs((s) => (item ? s.ids.has(item.id) : false));

	useEffect(() => {
		if (item) return;
		const client = useClientManager.getState().client;
		if (!client) return;
		let cancelled = false;
		void client.jobs
			.list({ envID })
			.then((response) => {
				if (cancelled) return;
				const job = response.jobs.find((candidate) => candidate.id === id);
				if (!job) {
					setErrorMessage('Job not found.');
					return;
				}
				const next: JobItem = {
					environmentID: envID,
					environmentName: envName,
					value: job,
					id: envName === undefined ? job.id : `${envID}/${job.id}`
				};
				jobItemCache.set(next);
				setItem(next);
			})
			.catch((error: unknown) => {
				if (!cancelled) setErrorMessage(friendlyErrorMessage(error));
			});
		return () => {
			cancelled = true;
		};
	}, [item, envID, envName, id]);

	return {
		item,
		errorMessage,
		isRunning,
		run: () => {
			if (item) void runJob(item);
		}
	};
}
