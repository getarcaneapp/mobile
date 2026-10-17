import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { ArcaneError, ArcaneServerError } from '@/sdk/errors/ArcaneError';
import { ArcaneRequestOptions } from '@/sdk/http/requestOptions';
import { EnvironmentUpdateJob, type EnvironmentUpdateResult } from '@/sdk/models/system/Upgrade';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { showToast, Toasts } from '@/ui/toast';

import {
	makeEnvironmentUpdateSceneModel,
	type EnvironmentUpdateRingEnvironment,
	type EnvironmentUpdateSceneKind,
	type EnvironmentUpdateSceneModel
} from './environment-update-scene.types';

export type UpdateAllPhase =
	| { kind: 'loading' }
	| { kind: 'ready'; lastJob?: EnvironmentUpdateJob }
	| { kind: 'triggering' }
	| { kind: 'polling'; job: EnvironmentUpdateJob }
	| { kind: 'reconnecting'; job: EnvironmentUpdateJob }
	| { kind: 'finished'; job: EnvironmentUpdateJob; note?: string }
	| { kind: 'unsupported'; message: string }
	| { kind: 'failed'; message: string };

const managerEnvID = '0';

export interface ResultCounts {
	updated: number;
	failed: number;
	skipped: number;
}

export function resultsInProcessingOrder(
	results: EnvironmentUpdateResult[]
): EnvironmentUpdateResult[] {
	const remote = results.filter((r) => r.environmentId !== managerEnvID);
	const manager = results.filter((r) => r.environmentId === managerEnvID);
	return [...remote, ...manager];
}

function isCompletedResult(result: EnvironmentUpdateResult): boolean {
	return result.status !== 'pending' && result.status !== 'updating';
}

function completedResultCount(results: EnvironmentUpdateResult[]): number {
	return results.filter(isCompletedResult).length;
}

function ringModels(results: EnvironmentUpdateResult[]): EnvironmentUpdateRingEnvironment[] {
	return results.map((result, index) => ({ result, slotIndex: index, totalCount: results.length }));
}

export function resultCounts(results: EnvironmentUpdateResult[]): ResultCounts {
	return {
		updated: results.filter(
			(r) => r.status === 'updated' || r.status === 'up_to_date' || r.status === 'triggered'
		).length,
		failed: results.filter((r) => r.status === 'failed').length,
		skipped: results.filter((r) => r.status === 'skipped_offline').length
	};
}

function displayVersion(raw: string | undefined): string | undefined {
	if (!raw || raw.includes(':') || raw.length > 20) return undefined;
	return raw;
}

export function lastRunSummary(job: EnvironmentUpdateJob): string {
	if (job.status === 'failed') return job.error ?? 'Failed';
	const counts = resultCounts(job.results ?? []);
	const parts = [`${counts.updated} updated`];
	if (counts.failed > 0) parts.push(`${counts.failed} failed`);
	if (counts.skipped > 0) parts.push(`${counts.skipped} skipped`);
	const version = displayVersion(job.managerTargetVersion);
	if (version) parts.push(version);
	return parts.join(' · ');
}

export function phaseKey(phase: UpdateAllPhase): number {
	switch (phase.kind) {
		case 'loading':
			return 0;
		case 'ready':
			return 1;
		case 'triggering':
			return 2;
		case 'polling':
			return phase.job.status === 'pending_restart' ? 4 : 3;
		case 'reconnecting':
			return 5;
		case 'finished':
			return 6;
		case 'unsupported':
			return 7;
		case 'failed':
			return 8;
	}
}

function progressModel(job: EnvironmentUpdateJob) {
	const results = resultsInProcessingOrder(job.results ?? []);
	const done = completedResultCount(results);
	return {
		results,
		done,
		progress: results.length === 0 ? undefined : done / results.length,
		active: results.find((r) => r.status === 'updating')
	};
}

export function sceneModel(
	phase: UpdateAllPhase,
	environmentCount: number
): EnvironmentUpdateSceneModel | undefined {
	switch (phase.kind) {
		case 'loading':
			return makeEnvironmentUpdateSceneModel({
				kind: 'loading',
				title: 'Checking readiness',
				subtitle: "Reading the manager's update status"
			});
		case 'ready':
			return makeEnvironmentUpdateSceneModel({
				kind: 'ready',
				title: 'Update every environment',
				subtitle:
					environmentCount === 1
						? '1 environment · latest release'
						: `${environmentCount} environments · latest release`
			});
		case 'triggering':
			return makeEnvironmentUpdateSceneModel({
				kind: 'starting',
				title: 'Starting the update',
				subtitle: 'Contacting the manager'
			});
		case 'polling': {
			const { results, done, progress, active } = progressModel(phase.job);
			if (phase.job.status === 'pending_restart') {
				return makeEnvironmentUpdateSceneModel({
					kind: 'restarting',
					title: 'Restarting the manager',
					subtitle: 'The environment updates are complete',
					progress,
					completedCount: done,
					totalCount: results.length,
					activeEnvironment: active,
					ringEnvironments: ringModels(results)
				});
			}
			return makeEnvironmentUpdateSceneModel({
				kind: 'updating',
				title: 'Updating environments',
				subtitle:
					results.length === 0 ? 'Preparing environments' : `${done} of ${results.length} complete`,
				progress,
				completedCount: done,
				totalCount: results.length,
				activeEnvironment: active,
				ringEnvironments: ringModels(results)
			});
		}
		case 'reconnecting': {
			const { results, done, progress, active } = progressModel(phase.job);
			return makeEnvironmentUpdateSceneModel({
				kind: 'reconnecting',
				title: 'Reconnecting',
				subtitle: 'Waiting for the manager to return',
				progress,
				completedCount: done,
				totalCount: results.length,
				activeEnvironment: active,
				ringEnvironments: ringModels(results)
			});
		}
		case 'finished': {
			const { job, note } = phase;
			const { results, done, progress, active } = progressModel(job);
			const counts = resultCounts(results);
			let kind: EnvironmentUpdateSceneKind;
			let title: string;
			if (job.status === 'failed') {
				kind = 'failed';
				title = 'Update failed';
			} else if (note != null || counts.failed > 0 || counts.skipped > 0) {
				kind = 'warning';
				title = note == null ? 'Finished with issues' : 'Manager restarting';
			} else {
				kind = 'completed';
				title = 'All updated';
			}
			return makeEnvironmentUpdateSceneModel({
				kind,
				title,
				subtitle:
					note ??
					(job.status === 'failed'
						? (job.error ?? 'The environment update failed.')
						: lastRunSummary(job)),
				progress,
				completedCount: done,
				totalCount: results.length,
				activeEnvironment: EnvironmentUpdateJob.isTerminal(job) ? undefined : active,
				ringEnvironments: ringModels(results)
			});
		}
		case 'unsupported':
		case 'failed':
			return undefined;
	}
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useUpdateAllEnvironmentsRoute(): { environmentCount: number } {
	const params = useLocalSearchParams<{ count?: string }>();
	const parsed = Number.parseInt(params.count ?? '', 10);
	return { environmentCount: Number.isFinite(parsed) ? parsed : 0 };
}

export function useUpdateAllEnvironments({
	environmentCount,
	startsImmediately = false
}: {
	environmentCount: number;
	startsImmediately?: boolean;
}) {
	const currentUser = useClientManager((s) => s.currentUser);
	const isAdmin = currentUser ? User.isAdmin(currentUser) : false;
	const [phase, setPhase] = useState<UpdateAllPhase>({ kind: 'loading' });

	const mounted = useRef(true);
	const pollGeneration = useRef(0);
	const started = useRef(false);

	const finish = (job: EnvironmentUpdateJob, note: string | undefined) => {
		setPhase({ kind: 'finished', job, note });
		if (note == null) {
			const failedCount = (job.results ?? []).filter((r) => r.status === 'failed').length;
			if (job.status === 'completed' && failedCount === 0) {
				showToast(Toasts.success('All environments updated'));
			} else if (job.status === 'failed') {
				showToast(Toasts.error(job.error ?? 'Environment update failed'));
			}
		}
		cachedClient()?.invalidateGlobal(['environments']);
		useResourceMutationStore.getState().markChanged('environments');
	};

	const startPolling = (client: ArcaneClient, initialJob: EnvironmentUpdateJob) => {
		const generation = ++pollGeneration.current;
		const isCancelled = () => !mounted.current || pollGeneration.current !== generation;
		void (async () => {
			let lastKnown = initialJob;
			let consecutiveFailures = 0;
			const maxFailures = 60;
			while (!isCancelled()) {
				await sleep(3000);
				if (isCancelled()) return;
				try {
					const job = await client.system.updateAllStatus({ envID: managerEnvID });
					if (isCancelled()) return;
					consecutiveFailures = 0;
					lastKnown = job;
					if (EnvironmentUpdateJob.isTerminal(job)) {
						finish(job, undefined);
						return;
					}
					setPhase({ kind: 'polling', job });
				} catch {
					if (isCancelled()) return;
					consecutiveFailures += 1;
					if (consecutiveFailures === 2) setPhase({ kind: 'reconnecting', job: lastKnown });
					if (consecutiveFailures >= maxFailures) {
						const managerStatus = EnvironmentUpdateJob.managerResult(lastKnown)?.status;
						const managerDone =
							lastKnown.status === 'pending_restart' &&
							(managerStatus === 'updated' ||
								managerStatus === 'triggered' ||
								managerStatus === 'updating');
						const note = managerDone
							? 'The Arcane manager is restarting — check back in a minute.'
							: "Lost connection before the update finished. Check the server once it's reachable again.";
						finish(lastKnown, note);
						return;
					}
				}
			}
		})();
	};

	const trigger = async (): Promise<void> => {
		const client = useClientManager.getState().client;
		if (!client) {
			setPhase({ kind: 'failed', message: 'Not connected' });
			return;
		}
		setPhase({ kind: 'triggering' });
		try {
			const job = await client
				.withRequestOptions(ArcaneRequestOptions.withActivityBatchID(randomUUID().toLowerCase()))
				.system.triggerUpdateAll({ envID: managerEnvID });
			setPhase({ kind: 'polling', job });
			startPolling(client, job);
		} catch (error) {
			if (error instanceof ArcaneError) {
				if (error.kind === 'conflict') {
					await preflight();
					return;
				}
				if (error.kind === 'notFound') {
					setPhase({
						kind: 'unsupported',
						message:
							"This Arcane server doesn't support updating all environments. Update the server first."
					});
					return;
				}
				if (error instanceof ArcaneServerError && error.serverMessage !== '') {
					setPhase({ kind: 'unsupported', message: error.serverMessage });
					return;
				}
			}
			setPhase({ kind: 'failed', message: friendlyErrorMessage(error) });
		}
	};

	const readyOrStart = async () => {
		if (startsImmediately) await trigger();
		else setPhase({ kind: 'ready' });
	};

	const preflight = async (): Promise<void> => {
		const client = useClientManager.getState().client;
		if (!client) {
			setPhase({ kind: 'failed', message: 'Not connected' });
			return;
		}
		setPhase({ kind: 'loading' });
		try {
			const job = await client.system.updateAllStatus({ envID: managerEnvID });
			if (EnvironmentUpdateJob.isTerminal(job)) {
				if (startsImmediately) await trigger();
				else setPhase({ kind: 'ready', lastJob: job });
			} else {
				setPhase({ kind: 'polling', job });
				startPolling(client, job);
			}
		} catch (error) {
			if (
				error instanceof ArcaneError &&
				(error.kind === 'notFound' || error.kind === 'decoding')
			) {
				await readyOrStart();
				return;
			}
			setPhase({ kind: 'failed', message: friendlyErrorMessage(error) });
		}
	};

	useEffect(() => {
		mounted.current = true;
		if (!started.current && isAdmin) {
			started.current = true;
			void preflight();
		}
		return () => {
			mounted.current = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isAdmin]);

	return {
		isAdmin,
		phase,
		phaseKey: phaseKey(phase),
		sceneModel: sceneModel(phase, environmentCount),
		doneTitle: phase.kind === 'finished' ? 'Done' : 'Close',
		interactiveDismissDisabled: phase.kind === 'triggering',
		trigger: () => void trigger(),
		retry: () => void preflight()
	};
}

export type UpdateAllEnvironmentsModel = ReturnType<typeof useUpdateAllEnvironments>;
