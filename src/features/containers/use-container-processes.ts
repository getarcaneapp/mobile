/** `ContainerProcessesView.load()`: `docker top`; a 409 means the container isn't running. */
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import { useClientManager } from '@/stores/client-manager';

import { processRows, type ContainerProcessList } from './container-model';

export function useContainerProcesses(environmentID: EnvironmentID, containerID: string) {
	const [list, setList] = useState<ContainerProcessList>();
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [notRunning, setNotRunning] = useState(false);
	const loading = useRef(false);

	const load = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client || loading.current) return;
		loading.current = true;
		setIsLoading(true);
		try {
			const path = client.rest.environmentPath(
				environmentID,
				`containers/${encodeURIComponent(containerID)}/processes`
			);
			setList(await client.rest.get<ContainerProcessList>(path));
			setNotRunning(false);
			setErrorMessage(undefined);
		} catch (error) {
			if (isArcaneError(error, 'conflict')) setNotRunning(true);
			else setErrorMessage(friendlyErrorMessage(error));
		} finally {
			loading.current = false;
			setIsLoading(false);
		}
	}, [environmentID, containerID]);

	useEffect(() => {
		void load();
	}, [load]);

	const rows = processRows(list);
	return { list, rows, isLoading, errorMessage, notRunning, load };
}
