import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

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
import { useDashboardStreamStore } from '@/stores/dashboard-stream-store';
import { environmentIsOnline } from '@/stores/dashboard-stream-logic';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { showToast, Toasts } from '@/ui/toast';

import {
	makeEnvironmentUpdateSceneModel,
	type EnvironmentUpdateRingEnvironment,
	type EnvironmentUpdateSceneKind,
	type EnvironmentUpdateSceneModel
} from './environment-update-scene.types';
import {
	defaultSelection,
	failedEnvironmentIDs,
	followUpgradeJob,
	managerEnvironmentID,
	managerRestarting,
	selectionRequest,
	type UpdateCandidate
} from './upgrade-job-follow';

export type { UpdateCandidate } from './upgrade-job-follow';

export type UpdateAllPhase =
	| { kind: 'loading' }
	| { kind: 'ready'; lastJob?: EnvironmentUpdateJob }
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
				title: environmentCount === 1 ? 'Update 1 environment' : 'Update every environment',
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

export function useUpdateAllEnvironmentsRoute(): { environmentCount: number } {
	const params = useLocalSearchParams<{ count?: string }>();
	const parsed = Number.parseInt(params.count ?? '', 10);
	return { environmentCount: Number.isFinite(parsed) ? parsed : 0 };
}

function useUpdateCandidates(): UpdateCandidate[] {
	const environments = useEnvironmentsStore(
		useShallow((s) => s.environments.filter((e) => e.enabled))
	);
	const versions = useDashboardStreamStore(
		useShallow((s) =>
			Object.fromEntries(
				environments.map((e) => {
					const info = s.statesByEnvironmentID[e.id]?.snapshot?.versionInfo;
					return [
						e.id,
						info
							? `${info.updateAvailable ? '1' : '0'}${info.displayVersion || info.currentVersion}`
							: ''
					];
				})
			)
		)
	);
	return [...environments]
		.sort(
			(a, b) =>
				Number(b.id === managerEnvironmentID) - Number(a.id === managerEnvironmentID) ||
				(a.name ?? a.id).localeCompare(b.name ?? b.id)
		)
		.map((environment) => {
			const encoded = versions[environment.id] ?? '';
			return {
				id: environment.id,
				name: environment.name || environment.id,
				isManager: environment.id === managerEnvironmentID,
				online: environmentIsOnline(environment),
				updateAvailable: encoded ? encoded.startsWith('1') : undefined,
				version: encoded.slice(1) || undefined
			};
		});
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
	const supportsJobs = useClientManager((s) => s.apiGeneration === 'v3');
	const candidates = useUpdateCandidates();
	const [phase, setPhase] = useState<UpdateAllPhase>({ kind: 'loading' });
	const [picked, setPicked] = useState<string[] | undefined>(undefined);
	const selected = picked ?? defaultSelection(candidates);

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

	const readyOrStart = async () => {
		if (startsImmediately && !supportsJobs) await trigger();
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
			const job = await client.system.updateAllStatus({ envID: managerEnvironmentID });
			if (EnvironmentUpdateJob.isTerminal(job)) {
				if (startsImmediately && !supportsJobs) await trigger();
				else setPhase({ kind: 'ready', lastJob: job });
			} else {
				setPhase({ kind: 'polling', job });
				follow(client, job);
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

	const toggle = (id: string) =>
		setPicked(selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id]);
	const failedIDs = phase.kind === 'finished' ? failedEnvironmentIDs(phase.job) : [];
	const jobResults =
		phase.kind === 'polling' || phase.kind === 'reconnecting' || phase.kind === 'finished'
			? resultsInProcessingOrder(phase.job.results ?? [])
			: [];

	return {
		isAdmin,
		supportsJobs,
		phase,
		phaseKey: phaseKey(phase),
		sceneModel: sceneModel(
			phase,
			supportsJobs && phase.kind === 'ready' ? selected.length : environmentCount
		),
		doneTitle: phase.kind === 'finished' ? 'Done' : 'Close',
		interactiveDismissDisabled: phase.kind === 'triggering',
		candidates,
		selected,
		toggle,
		selectAll: () => setPicked(candidates.map((c) => c.id)),
		selectNone: () => setPicked([]),
		triggerTitle:
			!supportsJobs || selected.length === candidates.length
				? 'Update All'
				: selected.length === 1
					? 'Update 1 Environment'
					: `Update ${selected.length} Environments`,
		canTrigger: !supportsJobs || selected.length > 0,
		jobResults,
		failedIDs,
		trigger: () => void trigger(supportsJobs ? selectionRequest(candidates, selected) : undefined),
		retryFailed: () => void trigger(failedIDs),
		retry: () => void preflight()
	};
}

export type UpdateAllEnvironmentsModel = ReturnType<typeof useUpdateAllEnvironments>;
