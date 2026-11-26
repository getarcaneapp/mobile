import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import {
	PodmanAutoUpdateResult,
	type PodmanAutoUpdateReport
} from '@/sdk/models/podman/PodmanAutoUpdate';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { usePodmanStatus } from '@/stores/podman-status-store';
import { showToast, Toasts } from '@/ui/toast';

import { plural, podmanChanged, usePodmanCan } from './podman-common';

export type AutoUpdateRow = PodmanAutoUpdateReport & { id: string };

function autoUpdateToast(response: PodmanAutoUpdateResult, dryRun: boolean) {
	const [firstError] = response.errors;
	if (firstError !== undefined) return Toasts.error(firstError);
	if (response.mode === 'systemd') return Toasts.success('Auto-update unit started');
	if (dryRun) return Toasts.success(`Checked ${plural(response.reports.length, 'container')}`);
	return Toasts.success(
		`Updated ${plural(PodmanAutoUpdateResult.updatedCount(response), 'container')}`
	);
}

async function runAutoUpdate(
	environmentID: EnvironmentID,
	dryRun: boolean,
	rollback: boolean
): Promise<PodmanAutoUpdateResult | undefined> {
	const client = useClientManager.getState().client;
	if (!client) return undefined;
	const response = await client.podman.runAutoUpdate({
		options: { dryRun, rollback },
		envID: environmentID
	});
	if (!dryRun) podmanChanged(environmentID);
	showToast(autoUpdateToast(response, dryRun));
	return response;
}

export function usePodmanAutoUpdate() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const environmentID = envID;
	const can = usePodmanCan(environmentID);
	const status = usePodmanStatus(environmentID);
	const [dryRun, setDryRun] = useState(true);
	const [rollback, setRollback] = useState(true);
	const [isRunning, setIsRunning] = useState(false);
	const [result, setResult] = useState<PodmanAutoUpdateResult>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const mode = result?.mode ?? status?.autoUpdateMode ?? 'unavailable';
	const canRun = can(Permission.Podman.autoUpdate) && mode !== 'unavailable';

	const run = async () => {
		setIsRunning(true);
		setErrorMessage(undefined);
		const wasDryRun = dryRun;
		await withCleanup(
			async () => {
				try {
					setResult(await runAutoUpdate(environmentID, wasDryRun, rollback));
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsRunning(false)
		);
	};

	const reports: AutoUpdateRow[] = (result?.reports ?? []).map((report, index) => ({
		...report,
		id: report.containerId || `${index}`
	}));

	return {
		environmentID,
		mode,
		modeTitle: mode === 'systemd' ? 'systemd unit' : mode === 'rest' ? 'Podman API' : 'Unavailable',
		supportsOptions: mode === 'rest',
		dryRun,
		setDryRun,
		rollback,
		setRollback,
		isRunning,
		canRun,
		result,
		reports,
		errors: result?.errors ?? [],
		unit: result?.unit,
		errorMessage,
		runTitle: mode === 'rest' && dryRun ? 'Check for Updates' : 'Run Auto-Update',
		run: () => void run()
	};
}

export type PodmanAutoUpdateModel = ReturnType<typeof usePodmanAutoUpdate>;
