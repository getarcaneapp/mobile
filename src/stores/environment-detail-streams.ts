import { useClientManager } from '@/stores/client-manager';
import {
	registerEnvironmentDetailStreams,
	useEnvironmentsStore
} from '@/stores/environments-store';

import { useDashboardStreamStore } from './dashboard-stream-store';
import { useSystemStatsHistoryStore } from './system-stats-history-store';

const dashboardStream = () => useDashboardStreamStore.getState();
const statsHistory = () => useSystemStatsHistoryStore.getState();

registerEnvironmentDetailStreams({
	configure: (client) => {
		dashboardStream().configure(client);
		statsHistory().configure(client);
	},
	start: ({ dashboardStream: runsDashboardStream }) => {
		statsHistory().start();
		if (runsDashboardStream) dashboardStream().start();
		else dashboardStream().stop();
	},
	stop: () => {
		dashboardStream().stop();
		statsHistory().stop();
	},
	reconcile: (environments) => dashboardStream().reconcile(environments),
	prioritizeStats: (ordered) => statsHistory().reconcile(ordered),
	refreshSnapshots: (environmentIDs) => dashboardStream().refresh(environmentIDs),
	isStreaming: () => dashboardStream().isStreaming() && !dashboardStream().streamUnsupported,
	actionItems: (environmentID) => {
		const state = dashboardStream().state(environmentID);
		return state?.hasLoaded ? state.snapshot?.actionItems : undefined;
	}
});

{
	const environments = useEnvironmentsStore.getState();
	const client = useClientManager.getState().client;
	if (environments.hasLoaded) {
		dashboardStream().configure(client);
		statsHistory().configure(client);
		dashboardStream().reconcile(environments.environments);
		environments.prioritizeStats(useClientManager.getState().activeEnvironmentID);
	}
}

export const environmentDetailStreamsRegistered = true;
