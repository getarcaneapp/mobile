import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { UpdaterResult, UpdaterStatus } from '@/sdk/models/updater/Updater';
import { useClientManager } from '@/stores/client-manager';
import { useImageUpdateCountStore } from '@/stores/image-update-count-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';

import {
	makeEnvironmentUpdateSceneModel,
	type EnvironmentUpdateSceneModel
} from '@/features/environments/environment-update-scene.types';

import { loadBoundedUpdaterStatus, runBoundedUpdater } from './updates-logic';

export type UpdaterRunPhase =
	| { kind: 'starting' }
	| { kind: 'running' }
	| { kind: 'completed'; result: UpdaterResult }
	| { kind: 'failed'; message: string };

const sleep = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener('abort', () => {
			clearTimeout(timer);
			resolve();
		});
	});

function plural(count: number, noun: string) {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function runningSubtitle(status: UpdaterStatus | undefined): string {
	if (!status) return 'Checking for available updates';
	const parts: string[] = [];
	if (status.updatingContainers > 0) parts.push(plural(status.updatingContainers, 'container'));
	if (status.updatingProjects > 0) parts.push(plural(status.updatingProjects, 'project'));
	return parts.length === 0 ? 'Checking for available updates' : `${parts.join(' · ')} in progress`;
}

export function completionSubtitle(result: UpdaterResult): string {
	const parts = [`${result.updated} updated`];
	if (result.failed > 0) parts.push(`${result.failed} failed`);
	if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
	parts.push(`in ${result.duration}`);
	return parts.join(' · ');
}

export function sceneModel(
	phase: UpdaterRunPhase,
	liveStatus: UpdaterStatus | undefined
): EnvironmentUpdateSceneModel {
	switch (phase.kind) {
		case 'starting':
			return makeEnvironmentUpdateSceneModel({
				kind: 'starting',
				title: 'Starting the updater',
				subtitle: 'Contacting the selected environment'
			});
		case 'running':
			return makeEnvironmentUpdateSceneModel({
				kind: 'updating',
				title: 'Updating containers',
				subtitle: runningSubtitle(liveStatus)
			});
		case 'completed':
			return makeEnvironmentUpdateSceneModel({
				kind: phase.result.failed === 0 ? 'completed' : 'warning',
				title: phase.result.failed === 0 ? 'Updater complete' : 'Finished with issues',
				subtitle: completionSubtitle(phase.result)
			});
		case 'failed':
			return makeEnvironmentUpdateSceneModel({
				kind: 'failed',
				title: 'Updater failed',
				subtitle: phase.message
			});
	}
}

export function useUpdaterRun(environmentID: EnvironmentID) {
	const [phase, setPhase] = useState<UpdaterRunPhase>({ kind: 'starting' });
	const [liveStatus, setLiveStatus] = useState<UpdaterStatus>();
	const controller = useRef<AbortController | undefined>(undefined);

	const start = useCallback(() => {
		const client = useClientManager.getState().client;
		if (!client) {
			setPhase({ kind: 'failed', message: 'Not connected' });
			return;
		}
		if (controller.current) return;
		const run = new AbortController();
		const poll = new AbortController();
		controller.current = run;
		run.signal.addEventListener('abort', () => poll.abort());
		setPhase({ kind: 'starting' });
		setLiveStatus(undefined);

		const pollLoop = async () => {
			await sleep(400, poll.signal);
			if (poll.signal.aborted) return;
			setPhase((current) => (current.kind === 'starting' ? { kind: 'running' } : current));
			while (!poll.signal.aborted) {
				try {
					const status = await loadBoundedUpdaterStatus(client, environmentID, poll.signal);
					if (poll.signal.aborted) return;
					setLiveStatus(status);
					setPhase((current) => (current.kind === 'starting' ? { kind: 'running' } : current));
				} catch {}
				await sleep(1500, poll.signal);
			}
		};
		void pollLoop();

		void (async () => {
			try {
				const result = await runBoundedUpdater(client, environmentID, run.signal);
				await useImageUpdateCountStore
					.getState()
					.refreshCount(environmentID, client, useClientManager.getState().currentUser?.id);
				useResourceMutationStore.getState().markChanged('images', environmentID);
				poll.abort();
				if (run.signal.aborted) return;
				setPhase({ kind: 'completed', result });
			} catch (error) {
				poll.abort();
				if (run.signal.aborted) return;
				setPhase({ kind: 'failed', message: friendlyErrorMessage(error) });
			} finally {
				if (controller.current === run) controller.current = undefined;
			}
		})();
	}, [environmentID]);

	const cancel = useCallback(() => {
		controller.current?.abort();
		controller.current = undefined;
	}, []);

	const retry = useCallback(() => {
		cancel();
		start();
	}, [cancel, start]);

	useEffect(() => {
		start();
		return cancel;
	}, [start, cancel]);

	const doneTitle = phase.kind === 'completed' || phase.kind === 'failed' ? 'Done' : 'Close';

	return { phase, liveStatus, retry, doneTitle, scene: sceneModel(phase, liveStatus) };
}
