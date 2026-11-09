import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { ArcaneError } from '@/sdk/errors/ArcaneError';
import { useClientManager } from '@/stores/client-manager';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import {
	EnvironmentUpdateJob,
	EnvironmentUpdateStage,
	type EnvironmentUpdateResult,
	type UpgradeCheckResult
} from '@/sdk/models/system/Upgrade';
import { User } from '@/sdk/models/user/User';

import { followUpgradeJob, managerEnvironmentID, managerRestarting } from './upgrade-job-follow';

export interface SystemUpgradeProgress {
	fraction: number;
	detail?: string;
	finished: boolean;
	logs?: string[];
}

export type SystemUpgradePhase =
	| { kind: 'checking' }
	| { kind: 'ready'; result: UpgradeCheckResult }
	| { kind: 'checkFailed'; message: string }
	| { kind: 'triggering' }
	| { kind: 'triggered'; message: string; progress?: SystemUpgradeProgress }
	| { kind: 'triggerFailed'; message: string; logs?: string[] };

export function jobResultProgress(
	result: EnvironmentUpdateResult | undefined,
	previous: SystemUpgradeProgress | undefined
): SystemUpgradeProgress {
	const percent = result?.percent ?? 0;
	return {
		fraction: Math.max(previous?.fraction ?? 0, Math.min(1, percent / 100)),
		detail:
			result?.status === 'updating' && result.stage
				? EnvironmentUpdateStage.label(result.stage)
				: result?.status === 'pending'
					? 'Waiting to start'
					: previous?.detail,
		finished: false,
		logs: result?.logs ?? previous?.logs ?? []
	};
}

async function startEnvironmentJob(
	client: ArcaneClient,
	environmentID: EnvironmentID
): Promise<EnvironmentUpdateJob> {
	try {
		return await client.system.triggerUpdateAll({
			envID: managerEnvironmentID,
			environmentIDs: [environmentID]
		});
	} catch (error) {
		if (!(error instanceof ArcaneError) || error.kind !== 'conflict') throw error;
		const active = await client.system.updateAllStatus({ envID: managerEnvironmentID });
		if (
			!EnvironmentUpdateJob.isTerminal(active) &&
			EnvironmentUpdateJob.result(active, environmentID)
		)
			return active;
		throw new Error('Another upgrade is already running. Try again once it finishes.', {
			cause: error
		});
	}
}

export const systemUpgradeConfirmationHost = 'system-upgrade';

export function useSystemUpgradeRoute() {
	const params = useLocalSearchParams<{ envID?: string; name?: string }>();
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const name = params.name !== undefined && params.name !== '' ? params.name : undefined;
	return {
		environmentID: params.envID ?? activeEnvironmentID,
		environmentName: name,
		isSheet: params.name === undefined
	};
}

export function useSystemUpgrade(
	environmentID: EnvironmentID,
	environmentName: string | undefined
) {
	const client = useClientManager((s) => s.client);
	const currentUser = useClientManager((s) => s.currentUser);
	const isAdmin = currentUser ? User.isAdmin(currentUser) : false;
	const supportsProgress = useClientManager((s) => s.apiGeneration === 'v3');
	const [phase, setPhase] = useState<SystemUpgradePhase>({ kind: 'checking' });
	const stopFollowing = useRef<(() => void) | undefined>(undefined);

	useEffect(() => () => stopFollowing.current?.(), []);

	const followJob = (activeClient: ArcaneClient, job: EnvironmentUpdateJob, message: string) => {
		stopFollowing.current?.();
		let progress = jobResultProgress(EnvironmentUpdateJob.result(job, environmentID), undefined);
		setPhase({ kind: 'triggered', message, progress });
		const update = (next: EnvironmentUpdateJob) => {
			progress = jobResultProgress(EnvironmentUpdateJob.result(next, environmentID), progress);
			setPhase({ kind: 'triggered', message, progress });
		};
		stopFollowing.current = followUpgradeJob({
			client: activeClient,
			job,
			streams: true,
			handlers: {
				onJob: update,
				onReconnecting: update,
				onFinish: (next) => {
					const result = EnvironmentUpdateJob.result(next, environmentID);
					const logs = result?.logs ?? progress.logs;
					if (result?.status === 'failed' || (next.status === 'failed' && !result)) {
						setPhase({
							kind: 'triggerFailed',
							message: result?.error || next.error || 'The upgrade failed.',
							logs
						});
						return;
					}
					if (result?.status === 'skipped_offline') {
						setPhase({
							kind: 'triggerFailed',
							message: 'The environment was offline, so it was skipped.',
							logs
						});
						return;
					}
					const version = result?.toVersion;
					setPhase({
						kind: 'triggered',
						message:
							result?.status === 'up_to_date'
								? 'Arcane is already on the newest image.'
								: version
									? `Arcane updated to ${version}.`
									: 'Arcane updated to the new version.',
						progress: { fraction: 1, finished: true, logs }
					});
				},
				onLost: (next) => {
					setPhase({
						kind: 'triggered',
						message: managerRestarting(next)
							? systemUpgradeCopy.reconnecting
							: "Lost connection before the upgrade finished. Check the server once it's reachable again."
					});
				}
			}
		});
	};

	const checkUpgrade = useCallback(async () => {
		if (!client) {
			setPhase({ kind: 'checkFailed', message: 'Not connected' });
			return;
		}
		setPhase({ kind: 'checking' });
		try {
			const result = await client.system.checkUpgrade({ envID: environmentID });
			setPhase({ kind: 'ready', result });
		} catch (error) {
			setPhase({ kind: 'checkFailed', message: friendlyErrorMessage(error) });
		}
	}, [client, environmentID]);

	const triggerUpgrade = async () => {
		if (!client) {
			setPhase({ kind: 'triggerFailed', message: 'Not connected' });
			return;
		}
		setPhase({ kind: 'triggering' });
		if (supportsProgress) {
			try {
				const job = await startEnvironmentJob(client, environmentID);
				followJob(client, job, 'Upgrade started. Arcane will restart shortly.');
			} catch (error) {
				setPhase({ kind: 'triggerFailed', message: friendlyErrorMessage(error) });
			}
			return;
		}
		try {
			await client.system.triggerUpgrade({ envID: environmentID });
		} catch (error) {
			setPhase({ kind: 'triggerFailed', message: friendlyErrorMessage(error) });
			return;
		}
		setPhase({ kind: 'triggered', message: 'Upgrade initiated. Arcane will restart shortly.' });
	};

	useEffect(() => {
		if (!isAdmin) return;
		void checkUpgrade();
	}, [isAdmin]);

	const confirmationMessage = environmentName
		? `Arcane on ${environmentName} will restart. The mobile app may briefly lose connection.`
		: 'Arcane will restart. The mobile app may briefly lose connection.';

	return {
		isAdmin,
		phase,
		checkUpgrade: () => void checkUpgrade(),
		triggerUpgrade: () => void triggerUpgrade(),
		confirmation: {
			title: 'Upgrade Arcane?',
			message: confirmationMessage,
			icon: 'arrow.up.circle',
			confirmTitle: 'Upgrade'
		}
	};
}

export type SystemUpgradeModel = ReturnType<typeof useSystemUpgrade>;

export const systemUpgradeCopy = {
	whatHappensNext:
		'A new Arcane container will be created from the latest image and replace this one. The mobile app will briefly lose connection while it restarts.',
	unsupported:
		'Arcane can only self-upgrade when running in a Docker container with access to the Docker socket. Update Arcane from your deployment instead.',
	reconnecting:
		"A new Arcane container is starting. The mobile app may briefly lose connection — pull to refresh once it's back."
};
