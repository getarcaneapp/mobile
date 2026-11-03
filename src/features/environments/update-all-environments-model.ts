import { randomUUID } from 'expo-crypto';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { ArcaneError, ArcaneServerError } from '@/sdk/errors/ArcaneError';
import { ArcaneRequestOptions } from '@/sdk/http/requestOptions';
import {
	EnvironmentUpdateJob,
	EnvironmentUpdateStage,
	type EnvironmentUpdateResult
} from '@/sdk/models/system/Upgrade';
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
import {
	failedEnvironmentIDs,
	followUpgradeJob,
	managerEnvironmentID,
	managerRestarting
} from './upgrade-job-follow';

export type UpdateAllPhase =
	| { kind: 'loading' }
	| { kind: 'triggering' }
	| { kind: 'polling'; job: EnvironmentUpdateJob }
	| { kind: 'reconnecting'; job: EnvironmentUpdateJob }
	| { kind: 'finished'; job: EnvironmentUpdateJob; note?: string }
	| { kind: 'unsupported'; message: string }
	| { kind: 'failed'; message: string };

export interface ResultCounts {
	updated: number;
	failed: number;
	skipped: number;
}

export function resultsInProcessingOrder(
	results: EnvironmentUpdateResult[]
): EnvironmentUpdateResult[] {
	const remote = results.filter((r) => r.environmentId !== managerEnvironmentID);
	const manager = results.filter((r) => r.environmentId === managerEnvironmentID);
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

export interface RunCounts {
	updating: number;
	pending: number;
	done: number;
	failed: number;
}

export function runCounts(results: readonly EnvironmentUpdateResult[]): RunCounts {
	const counts: RunCounts = { updating: 0, pending: 0, done: 0, failed: 0 };
	for (const result of results) {
		if (result.status === 'updating') counts.updating += 1;
		else if (result.status === 'pending') counts.pending += 1;
		else if (result.status === 'failed') counts.failed += 1;
		else counts.done += 1;
	}
	return counts;
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

function resultProgress(result: EnvironmentUpdateResult): number {
	if (isCompletedResult(result)) return 1;
	return Math.min(1, Math.max(0, (result.percent ?? 0) / 100));
}

function progressModel(job: EnvironmentUpdateJob) {
	const results = resultsInProcessingOrder(job.results ?? []);
	const done = completedResultCount(results);
	const reportsPercent = results.some((r) => r.percent !== undefined);
	let progress: number | undefined;
	if (results.length > 0) {
		progress = reportsPercent
			? results.reduce((sum, r) => sum + resultProgress(r), 0) / results.length
			: done / results.length;
	}
	return {
		results,
		done,
		progress,
		active: results.find((r) => r.status === 'updating')
	};
}

function activeStageSuffix(
	results: EnvironmentUpdateResult[],
	active: EnvironmentUpdateResult | undefined
): string {
	const updating = results.filter((r) => r.status === 'updating').length;
	if (updating > 1) return ` · ${updating} updating`;
	if (!active?.stage) return '';
	return ` · ${EnvironmentUpdateStage.label(active.stage)}`;
}

export function sceneModel(phase: UpdateAllPhase): EnvironmentUpdateSceneModel | undefined {
	switch (phase.kind) {
		case 'loading':
			return makeEnvironmentUpdateSceneModel({
				kind: 'loading',
				title: 'Checking readiness',
				subtitle: "Reading the manager's update status"
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
					results.length === 0
						? 'Preparing environments'
						: `${done} of ${results.length} complete${activeStageSuffix(results, active)}`,
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

export function useUpdateAllEnvironments() {
	const currentUser = useClientManager((s) => s.currentUser);
	const isAdmin = currentUser ? User.isAdmin(currentUser) : false;
	const supportsJobs = useClientManager((s) => s.apiGeneration === 'v3');
	const [phase, setPhase] = useState<UpdateAllPhase>({ kind: 'loading' });

	const mounted = useRef(true);
	const started = useRef(false);
	const stopFollowing = useRef<(() => void) | undefined>(undefined);

	const finish = (job: EnvironmentUpdateJob, note: string | undefined) => {
		setPhase({ kind: 'finished', job, note });
		if (note == null) {
			const failedCount = failedEnvironmentIDs(job).length;
			if (job.status === 'completed' && failedCount === 0) {
				showToast(Toasts.success('All environments updated'));
			} else if (job.status === 'failed') {
				showToast(Toasts.error(job.error ?? 'Environment update failed'));
			}
		}
		cachedClient()?.invalidateGlobal(['environments']);
		useResourceMutationStore.getState().markChanged('environments');
	};

	const follow = (client: ArcaneClient, initialJob: EnvironmentUpdateJob) => {
		stopFollowing.current?.();
		const live = () => mounted.current;
		stopFollowing.current = followUpgradeJob({
			client,
			job: initialJob,
			streams: supportsJobs,
			handlers: {
				onJob: (job) => {
					if (live()) setPhase({ kind: 'polling', job });
				},
				onFinish: (job) => {
					if (live()) finish(job, undefined);
				},
				onReconnecting: (job) => {
					if (live()) setPhase({ kind: 'reconnecting', job });
				},
				onLost: (job) => {
					if (!live()) return;
					finish(
						job,
						managerRestarting(job)
							? 'The Arcane manager is restarting — check back in a minute.'
							: "Lost connection before the update finished. Check the server once it's reachable again."
					);
				}
			}
		});
	};

	const trigger = async (environmentIDs?: string[]): Promise<void> => {
		const client = useClientManager.getState().client;
		if (!client) {
			setPhase({ kind: 'failed', message: 'Not connected' });
			return;
		}
		setPhase({ kind: 'triggering' });
		try {
			const job = await client
				.withRequestOptions(ArcaneRequestOptions.withActivityBatchID(randomUUID().toLowerCase()))
				.system.triggerUpdateAll({
					envID: managerEnvironmentID,
					environmentIDs: supportsJobs ? environmentIDs : undefined
				});
			setPhase({ kind: 'polling', job });
			follow(client, job);
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

	const preflight = async (): Promise<void> => {
		const client = useClientManager.getState().client;
		if (!client) {
			setPhase({ kind: 'failed', message: 'Not connected' });
			return;
		}
		setPhase({ kind: 'loading' });
		try {
			const job = await client.system.updateAllStatus({ envID: managerEnvironmentID });
			if (EnvironmentUpdateJob.isTerminal(job)) {
				await trigger();
			} else {
				setPhase({ kind: 'polling', job });
				follow(client, job);
			}
		} catch (error) {
			if (
				error instanceof ArcaneError &&
				(error.kind === 'notFound' || error.kind === 'decoding')
			) {
				await trigger();
				return;
			}
			setPhase({ kind: 'failed', message: friendlyErrorMessage(error) });
		}
	};

	const startPreflight = useEffectEvent(() => {
		void preflight();
	});

	useEffect(() => {
		mounted.current = true;
		if (!started.current && isAdmin) {
			started.current = true;
			startPreflight();
		}
		return () => {
			mounted.current = false;
			stopFollowing.current?.();
		};
	}, [isAdmin]);

	const failedIDs = phase.kind === 'finished' ? failedEnvironmentIDs(phase.job) : [];
	const jobResults =
		phase.kind === 'polling' || phase.kind === 'reconnecting' || phase.kind === 'finished'
			? resultsInProcessingOrder(phase.job.results ?? [])
			: [];

	return {
		isAdmin,
		supportsJobs,
		phase,
		sceneModel: sceneModel(phase),
		doneTitle: phase.kind === 'finished' ? 'Done' : 'Close',
		interactiveDismissDisabled: phase.kind === 'triggering',
		jobResults,
		runCounts: runCounts(jobResults),
		failedIDs,
		retryFailed: () => void trigger(failedIDs),
		retry: () => void preflight()
	};
}

export type UpdateAllEnvironmentsModel = ReturnType<typeof useUpdateAllEnvironments>;
