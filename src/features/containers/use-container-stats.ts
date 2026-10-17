import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';

import {
	appendFrame,
	chartSeries,
	parseContainerStatsFrame,
	type ContainerStatsChartSeries,
	type ContainerStatsFrame
} from './container-stats-frame';

export function useContainerStats(environmentID: EnvironmentID, containerID: string) {
	const [frames, setFrames] = useState<ContainerStatsFrame[]>([]);
	const [series, setSeries] = useState<ContainerStatsChartSeries>(() => chartSeries([]));
	const [errorMessage, setErrorMessage] = useState<string>();
	const framesRef = useRef<ContainerStatsFrame[]>([]);
	const controllerRef = useRef<AbortController | undefined>(undefined);

	const startStreaming = useCallback(() => {
		const client = useClientManager.getState().client;
		if (!client) return;
		controllerRef.current?.abort();
		const controller = new AbortController();
		controllerRef.current = controller;
		setErrorMessage(undefined);
		void (async () => {
			let previous = framesRef.current[framesRef.current.length - 1];
			try {
				for await (const payload of client
					.withSignal(controller.signal)
					.containers.stats({ envID: environmentID, id: containerID })) {
					if (controller.signal.aborted) break;
					const parsed = parseContainerStatsFrame(payload.raw, previous);
					if (!parsed) continue;
					previous = parsed;
					framesRef.current = appendFrame(framesRef.current, parsed);
					setFrames(framesRef.current);
					setSeries(chartSeries(framesRef.current));
				}
			} catch (error) {
				if (controller.signal.aborted || isCancellation(error)) return;
				setErrorMessage(`Stats stream ended: ${friendlyErrorMessage(error)}`);
			}
		})();
	}, [environmentID, containerID]);

	useEffect(() => {
		startStreaming();
		return () => controllerRef.current?.abort();
	}, [startStreaming]);

	return { frames, latest: frames[frames.length - 1], series, errorMessage, retry: startStreaming };
}
