import { hasPermission } from '@/core/auth/permissions';
import { isCancellation } from '@/core/errors';
import { LiveActivities } from '@/core/live-activities';
import {
	activityProgress,
	backupRunOutcome,
	type TrackedProgress
} from '@/core/operation-progress';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { EnvironmentID } from '@/sdk/client/environment';
import type { BackupHistoryEntry } from '@/sdk/models/backup/BackupHistoryEntry';
import type { SystemBackupRun } from '@/sdk/models/backup/SystemBackupRun';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';

const pollIntervalMs = 3_000;
const maxTrackingMs = 2 * 60 * 60 * 1_000;
const backingUpPhase = 'Backing up';

let counter = 0;

function environmentName(): string {
	return (
		useEnvironmentsStore.getState().displayName(EnvironmentID.localDocker) ??
		useClientManager.getState().activeEnvironmentName
	);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function activityState(
	client: ArcaneClient,
	activityID: string
): Promise<TrackedProgress | undefined> {
	const detail = await client.activities.detail({
		envID: EnvironmentID.localDocker,
		activityID,
		limit: 1
	});
	return activityProgress(detail.activity, backingUpPhase);
}

async function runState(client: ArcaneClient, runID: string): Promise<TrackedProgress | undefined> {
	const page = await client.systemBackups.list({
		query: { start: 0, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' }
	});
	const run = page.data.find((item) => item.id === runID);
	if (!run) return undefined;
	const outcome = backupRunOutcome(run.status);
	return outcome ? { outcome, phase: run.status } : { phase: backingUpPhase };
}

async function pollBackup(
	client: ArcaneClient,
	session: number,
	key: string,
	run: SystemBackupRun
) {
	const deadline = Date.now() + maxTrackingMs;
	let activityID =
		run.activityId && hasPermission('activities:read', EnvironmentID.localDocker)
			? run.activityId
			: undefined;
	while (LiveActivities.isActive(key)) {
		await wait(pollIntervalMs);
		if (!LiveActivities.isActive(key)) return;
		if (useClientManager.getState().clientGeneration !== session || Date.now() > deadline) {
			LiveActivities.dismiss(key);
			return;
		}
		let state: TrackedProgress | undefined;
		if (activityID) {
			state = await activityState(client, activityID).catch((error: unknown) => {
				if (!isCancellation(error)) activityID = undefined;
				return undefined;
			});
		}
		if (!activityID) state = await runState(client, run.id).catch(() => undefined);
		if (!state) continue;
		if (state.outcome) {
			LiveActivities.finish(key, state.outcome, state.progress);
			return;
		}
		LiveActivities.update(key, state);
	}
}

export function trackSystemBackup(run: SystemBackupRun) {
	if (!LiveActivities.isSupported()) return;
	const manager = useClientManager.getState();
	const client = manager.client;
	if (!client) return;
	const key = `system-backup-${++counter}`;
	LiveActivities.start(
		key,
		{
			title: 'Back Up Arcane',
			symbolName: 'externaldrive.badge.timemachine',
			environmentName: environmentName()
		},
		{ phase: backingUpPhase }
	);
	const outcome = backupRunOutcome(run.status);
	if (outcome) {
		LiveActivities.finish(key, outcome);
		return;
	}
	void pollBackup(client, manager.clientGeneration, key, run);
}

export async function withRestoreActivity<T>(
	entry: BackupHistoryEntry,
	restore: () => Promise<T>
): Promise<T> {
	const isVolume = entry.resourceType === 'volume';
	const key = `backup-restore-${++counter}`;
	LiveActivities.start(
		key,
		{
			title: `Restore ${entry.resourceName || 'Arcane'}`,
			symbolName: 'arrow.counterclockwise',
			environmentName: environmentName()
		},
		{ phase: 'Restoring' }
	);
	try {
		const result = await restore();
		LiveActivities.finish(key, 'success', undefined, isVolume ? undefined : 'Restore started');
		return result;
	} catch (error) {
		LiveActivities.finish(key, isCancellation(error) ? 'cancelled' : 'failure');
		throw error;
	}
}
