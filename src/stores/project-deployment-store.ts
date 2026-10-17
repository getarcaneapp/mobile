import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import {
	boundedText,
	nonnegative,
	RemoteDataLimits,
	saturatingAdd
} from '@/core/networking/remote-data-limits';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { DeployOptions } from '@/sdk/models/project/Project';
import type { OperationStreamEvent } from '@/sdk/types/streaming/OperationStreamEvent';
import { useClientManager } from '@/stores/client-manager';
import { useContainerDeploymentStore } from '@/stores/container-deployment-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import type { DeploymentOperation, InstallStreamLine } from '@/ui/components/install-stream.types';
import { finishActivityToast, showActivityToast, showToast, Toasts } from '@/ui/toast';

export type ProjectDeploymentKind = 'up' | 'redeploy' | 'pull' | 'build';

const verb: Record<ProjectDeploymentKind, string> = {
	up: 'Deploy',
	redeploy: 'Redeploy',
	pull: 'Pull Images',
	build: 'Build Images'
};
const kindSymbol: Record<ProjectDeploymentKind, string> = {
	up: 'shippingbox.fill',
	redeploy: 'arrow.triangle.2.circlepath',
	pull: 'arrow.down',
	build: 'hammer.fill'
};

const maxLines = 2000;
const lineTrim = 200;
const maxPhases = 100;
const maxPullLayers = 2_000;
const terminalLingerMs = 4000;
const layerDoneStatuses = new Set(['Pull complete', 'Already exists', 'Download complete']);

type ProjectOperation = DeploymentOperation & {
	kind: ProjectDeploymentKind;
	envID: EnvironmentID;
	targetID: string;
	targetName: string;
	environmentName: string;
	seenPhases: string[];
};

type State = {
	operation?: ProjectOperation;
	isSheetPresented: boolean;
	isRunning: () => boolean;
	start: (args: {
		kind: ProjectDeploymentKind;
		envID: EnvironmentID;
		targetID: string;
		targetName: string;
		environmentName: string;
		deployOptions?: DeployOptions;
		presentSheet?: () => void;
	}) => boolean;
	cancel: () => void;
	acknowledge: () => void;
	setSheetPresented: (presented: boolean) => void;
};

let counter = 0;
let abort: AbortController | undefined;
let userCancelRequested = false;
let autoClear: ReturnType<typeof setTimeout> | undefined;
let presentSheet: (() => void) | undefined;
let pendingLines: InstallStreamLine[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let pullLayers = new Map<string, { current: number; total: number }>();
let lineCounter = 0;

function title(kind: ProjectDeploymentKind, targetName: string) {
	return kind === 'pull' || kind === 'build' ? verb[kind] : `${verb[kind]} ${targetName}`;
}

function displayText(event: OperationStreamEvent): string | undefined {
	if (event.log !== undefined) return event.log;
	const error = event.error?.trim();
	if (error) return error;
	if (event.stream !== undefined) return event.stream;
	let output = '';
	if (event.id) output = `${boundedText(event.id, 512)}:`;
	if (event.status) output += `${output === '' ? '' : ' '}${boundedText(event.status, 2_048)}`;
	if (event.progress) output += `${output === '' ? '' : ' '}${boundedText(event.progress, 2_048)}`;
	return output === '' ? undefined : output;
}

export const useProjectDeploymentStore = create<State>((set, get) => {
	const patch = (update: Partial<ProjectOperation>) => {
		const operation = get().operation;
		if (operation) set({ operation: { ...operation, ...update } });
	};

	const trim = (lines: InstallStreamLine[]) => {
		if (lines.length <= maxLines) return lines;
		return lines.slice(Math.max(lineTrim, lines.length - maxLines));
	};

	const flush = () => {
		if (flushTimer) clearTimeout(flushTimer);
		flushTimer = undefined;
		const operation = get().operation;
		if (!operation || pendingLines.length === 0) return;
		const lines = trim([...operation.lines, ...pendingLines]);
		pendingLines = [];
		patch({ lines });
	};

	const append = (text: string, isError: boolean) => {
		flush();
		const operation = get().operation;
		if (!operation) return;
		patch({
			lines: trim([
				...operation.lines,
				{
					id: `l${++lineCounter}`,
					text: boundedText(text, RemoteDataLimits.maximumStreamLineBytes),
					isError
				}
			])
		});
	};

	const appendStreamed = (text: string, isError: boolean) => {
		pendingLines.push({
			id: `l${++lineCounter}`,
			text: boundedText(text, RemoteDataLimits.maximumStreamLineBytes),
			isError
		});
		if (!flushTimer) flushTimer = setTimeout(flush, 100);
	};

	const updatePhase = (phase: string) => {
		const operation = get().operation;
		if (!operation) return;
		const bounded = boundedText(phase, 512);
		if (bounded === operation.currentPhase) return;
		const seenPhases =
			operation.seenPhases.length < maxPhases && !operation.seenPhases.includes(bounded)
				? [...operation.seenPhases, bounded]
				: operation.seenPhases;
		patch({ currentPhase: bounded, seenPhases });
	};

	const updateProgress = (event: OperationStreamEvent) => {
		if (!event.id) return;
		const layerID = boundedText(event.id, 512);
		const detail = event.progressDetail;
		if (detail?.total !== undefined && detail.total > 0) {
			if (!pullLayers.has(layerID) && pullLayers.size >= maxPullLayers) return;
			const total = nonnegative(detail.total);
			pullLayers.set(layerID, {
				current: Math.min(nonnegative(detail.current ?? 0), total),
				total
			});
		} else if (event.status && layerDoneStatuses.has(event.status)) {
			const known = pullLayers.get(layerID);
			if (known) pullLayers.set(layerID, { current: known.total, total: known.total });
		}
		let current = 0;
		let total = 0;
		for (const layer of pullLayers.values()) {
			current = saturatingAdd(current, layer.current);
			total = saturatingAdd(total, layer.total);
		}
		if (total <= 0) return;
		const fraction = Math.min(current / total, 1);
		const operation = get().operation;
		if (operation && fraction > (operation.progressFraction ?? 0))
			patch({ progressFraction: fraction });
	};

	const reportProgress = () => {
		const operation = get().operation;
		if (!operation || get().isSheetPresented || operation.status.kind !== 'running') return;
		showActivityToast(operation.id, operation.title, operation.progressFraction, () =>
			presentSheet?.()
		);
	};

	const scheduleAutoClear = (id: string) => {
		if (autoClear) clearTimeout(autoClear);
		autoClear = setTimeout(() => {
			if (get().operation?.id === id && !get().isSheetPresented) get().acknowledge();
		}, terminalLingerMs);
	};

	const finishPresentation = (operation: ProjectOperation) => {
		if (!get().isSheetPresented) scheduleAutoClear(operation.id);
	};

	const markFailed = (message: string) => {
		const operation = get().operation;
		if (!operation) return;
		append(message, true);
		patch({
			status: { kind: 'failure', message },
			currentPhase: message === 'Cancelled' ? 'Cancelled' : 'Failed'
		});
		void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
		if (!get().isSheetPresented) {
			const cancelled = message === 'Cancelled';
			finishActivityToast(operation.id, operation.title, cancelled ? 'cancelled' : 'failure');
			showToast({
				...Toasts.error(
					cancelled ? `${operation.title} cancelled` : `${operation.title} failed: ${message}`
				),
				actionTitle: 'View',
				action: () => {
					if (get().operation) presentSheet?.();
					return true;
				}
			});
		}
		finishPresentation(operation);
	};

	return {
		operation: undefined,
		isSheetPresented: false,
		isRunning: () => get().operation?.status.kind === 'running',

		start: ({
			kind,
			envID,
			targetID,
			targetName,
			environmentName,
			deployOptions,
			presentSheet: present
		}) => {
			if (get().isRunning() || useContainerDeploymentStore.getState().isRunning) {
				showToast(Toasts.info('Another deployment is running'));
				return false;
			}
			const baseClient = useClientManager.getState().client;
			if (!baseClient) return false;
			const session = useClientManager.getState().clientGeneration;
			if (autoClear) clearTimeout(autoClear);
			autoClear = undefined;
			userCancelRequested = false;
			pendingLines = [];
			pullLayers = new Map();
			abort = new AbortController();
			const client = baseClient.withSignal(abort.signal);
			presentSheet = present;

			const operation: ProjectOperation = {
				id: `project-deployment-${++counter}`,
				kind,
				envID,
				targetID,
				targetName,
				environmentName,
				title: title(kind, targetName),
				systemImage: kindSymbol[kind],
				status: { kind: 'running' },
				lines: [],
				seenPhases: []
			};
			set({ operation });
			if (present) present();
			else reportProgress();

			void (async () => {
				try {
					const stream =
						kind === 'up'
							? client.projects.deployStream({ envID, projectID: targetID, options: deployOptions })
							: kind === 'redeploy'
								? client.projects.redeployStream({ envID, projectID: targetID })
								: kind === 'pull'
									? client.projects.pullImagesStream({ envID, projectID: targetID })
									: client.projects.buildStream({ envID, projectID: targetID });
					const signal = abort?.signal;
					for await (const event of signal ? stream.withSignal(signal) : stream) {
						if (get().operation?.id !== operation.id) return;
						const isError = (event.error?.trim() ?? '') !== '';
						const display = displayText(event);
						if (display !== undefined) appendStreamed(display, isError);
						if (!isError) {
							const phase = (event.phase ?? event.status)?.trim();
							if (phase) updatePhase(phase);
							updateProgress(event);
						}
						reportProgress();
					}
					flush();
					if (useClientManager.getState().clientGeneration !== session) {
						set({ operation: undefined });
						return;
					}
					if (get().operation?.id !== operation.id) return;
					if (userCancelRequested) {
						markFailed('Cancelled');
						return;
					}
					patch({ status: { kind: 'success' }, currentPhase: 'Complete' });
					const cached = cachedClient();
					const envPath = (suffix: string) => baseClient.rest.environmentPath(envID, suffix);
					cached?.invalidate(envID, [
						envPath('projects') + '*',
						envPath('projects/*'),
						envPath('containers'),
						envPath('containers/*')
					]);
					useResourceMutationStore.getState().markChanged('projects', envID);
					void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
					if (!get().isSheetPresented)
						finishActivityToast(operation.id, operation.title, 'success');
					finishPresentation(operation);
				} catch (error) {
					flush();
					if (get().operation?.id !== operation.id || get().operation?.status.kind !== 'running')
						return;
					if (userCancelRequested || isCancellation(error)) {
						markFailed('Cancelled');
						return;
					}
					markFailed(friendlyErrorMessage(error));
				}
			})();
			return true;
		},

		cancel: () => {
			if (!get().isRunning() || userCancelRequested) return;
			userCancelRequested = true;
			updatePhase('Cancelling');
			abort?.abort();
		},

		acknowledge: () => {
			if (get().operation?.status.kind === 'running') return;
			if (autoClear) clearTimeout(autoClear);
			autoClear = undefined;
			presentSheet = undefined;
			set({ operation: undefined, isSheetPresented: false });
		},

		setSheetPresented: (presented) => {
			set({ isSheetPresented: presented });
			const operation = get().operation;
			if (!presented && operation) {
				if (operation.status.kind === 'running') reportProgress();
				else scheduleAutoClear(operation.id);
			}
		}
	};
});
