import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import { useDashboardStreamStore } from '@/stores/dashboard-stream-store';

import { environmentRowCounts, loadedSnapshot } from './dashboard-logic';

export function useEnvironmentCounts(environmentID: string, info: DockerInfo | undefined) {
	const state = useDashboardStreamStore((s) => s.statesByEnvironmentID[environmentID]);
	if (!info && !loadedSnapshot(state)) return undefined;
	return environmentRowCounts(state, info);
}
