import { useEffect, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { ResponseCache } from '@/core/networking/response-cache';
import { withCleanup } from '@/core/with-cleanup';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { Permission } from '@/sdk/models/role/Permission';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import { useClientManager } from '@/stores/client-manager';
import { SystemStatsDisplay } from '@/stores/dashboard-stream-logic';
import { useDashboardEnvironmentState } from '@/stores/dashboard-stream-store';
import { useEnvironmentColorStore } from '@/stores/environment-color-store';
import { useStatsSeries } from '@/stores/system-stats-history-store';
import { showToast, Toasts } from '@/ui/toast';

import {
	actionCount,
	actionCountText,
	environmentRowCounts,
	environmentRowSubtitle,
	environmentStatusTint,
	loadedSnapshot,
	memoryPercentFor
} from './dashboard-logic';

export const revealedEnvironmentIDs = new Set<string>();

export function useEnvironmentRow(
	environment: Environment,
	dockerInfo: DockerInfo | undefined,
	onRefresh: () => Promise<void>
) {
	const streamState = useDashboardEnvironmentState(environment.id);
	const series = useStatsSeries(environment.id);
	const serverURL = useClientManager((s) => s.serverURL);
	const colorHex = useEnvironmentColorStore((s) => s.hex(serverURL, environment.id));
	const [isSyncing, setIsSyncing] = useState(false);
	const [canUpgrade, setCanUpgrade] = useState(false);
	const canPrune = useClientManager(() => hasPermission(Permission.System.prune, environment.id));

	const snapshot = loadedSnapshot(streamState);
	const stats = series?.latest;
	const actionItems = snapshot?.actionItems;
	const updateAvailable = snapshot?.versionInfo?.updateAvailable === true;

	useEffect(() => {
		const client = useClientManager.getState().client;
		if (!updateAvailable || !hasPermission(Permission.System.upgrade, environment.id) || !client) {
			setCanUpgrade(false);
			return;
		}
		let cancelled = false;
		client.system
			.checkUpgrade({ envID: environment.id })
			.then((result) => !cancelled && setCanUpgrade(result.canUpgrade))
			.catch(() => !cancelled && setCanUpgrade(false));
		return () => {
			cancelled = true;
		};
	}, [updateAvailable, environment.id]);

	const sync = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsSyncing(true);
		await withCleanup(
			async () => {
				try {
					await client.environments.sync({ id: environment.id });
					ResponseCache.invalidateEnvironment(environment.id);
					await onRefresh();
					showToast(Toasts.success('Environment synced'));
				} catch {
					showToast(Toasts.error('Sync failed'));
				}
			},
			() => setIsSyncing(false)
		);
	};

	const counts = environmentRowCounts(streamState, dockerInfo);
	const vulnerabilities = actionCount(actionItems, 'actionable_vulnerabilities');
	return {
		streamState,
		colorHex,
		isSyncing,
		canUpgrade,
		canPrune,
		sync,
		subtitle: environmentRowSubtitle(streamState, dockerInfo),
		statusTint: environmentStatusTint(streamState, dockerInfo),
		streamError: streamState?.streamError === true,
		updatesText: actionCountText(actionItems, 'image_updates'),
		containersText: `${counts.running}/${counts.total}`,
		imagesText: String(counts.images),
		vulnerabilitiesText: actionCountText(actionItems, 'actionable_vulnerabilities'),
		vulnerabilities,
		cpuPercent: stats ? SystemStatsDisplay.cpuPercent(stats) : undefined,
		memoryPercent: memoryPercentFor(stats, dockerInfo),
		diskPercent: SystemStatsDisplay.diskPercent(stats)
	};
}

export const ringValueText = (percent: number | undefined) =>
	percent === undefined ? '—' : `${Math.round(percent)}%`;
