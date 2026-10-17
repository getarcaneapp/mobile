/**
 * Port of `DashboardStreamStore.swift`: consumes the aggregated
 * `GET /dashboard/stream` NDJSON endpoint (one connection covering every
 * enabled environment) and tracks per-environment dashboard snapshots.
 * Older servers without the endpoint latch `streamUnsupported` after a single
 * 404 and the dashboard falls back to one REST snapshot pass.
 *
 * Owned by `EnvironmentsStore` (see `environment-detail-streams.ts`).
 */
import { create } from 'zustand';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import {
	DashboardStreamEvent,
	type DashboardSnapshot,
	type DashboardStreamErrorCode
} from '@/sdk/models/dashboard';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';

import {
	applyError,
	applySnapshot,
	clearAllStreamErrors,
	emptyAttention,
	invalidateSnapshots,
	nextReconnect,
	reconcileStates,
	resolvedAggregate,
	resolvedAttention,
	sameAggregate,
	sameAttention,
	StreamBackoff,
	type AggregateCounts,
	type AttentionSummary,
	type DashboardEnvironmentState,
	type DashboardStates
} from './dashboard-stream-logic';

type DashboardStreamState = {
	statesByEnvironmentID: DashboardStates;
	connected: boolean;
	/** Set after the fast reconnect budget is exhausted; cleared by retry() or a reconnect. */
	streamFailed: boolean;
	/** Latched when the server 404s the stream endpoint. Permanent until configure() sees a new client. */
	streamUnsupported: boolean;
	/** Cached separately so consumers update only when a displayed count changes. */
	aggregate: AggregateCounts | undefined;
	attention: AttentionSummary;

	isStreaming: () => boolean;
	state: (environmentID: string) => DashboardEnvironmentState | undefined;
	configure: (client: ArcaneClient | undefined) => void;
	start: () => void;
	stop: () => void;
	retry: () => void;
	/** Pull-to-refresh: force a fresh connection. */
	reconnect: () => void;
	reconcile: (environments: Environment[]) => void;
	/** Re-fetch snapshots over REST; each applies as it arrives. */
	refresh: (environmentIDs?: string[]) => Promise<void>;
};

const sleep = (seconds: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, seconds * 1000);
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true }
		);
	});

export const useDashboardStreamStore = create<DashboardStreamState>((set, get) => {
	let client: ArcaneClient | undefined;
	let clientIdentity: object | undefined;
	let streamTask: AbortController | undefined;
	/** Desired lifecycle state; the task can be gone while the dashboard still wants it. */
	let shouldRun = false;
	/** Bumped on every stop()/start() so stale events can't mutate the current generation. */
	let generation = 0;

	/** Publishes new states and rebuilds the derived aggregate/attention values. */
	const commit = (states: DashboardStates) => {
		const aggregate = resolvedAggregate(states);
		const attention = resolvedAttention(states);
		const current = get();
		set({
			statesByEnvironmentID: states,
			...(sameAggregate(aggregate, current.aggregate) ? {} : { aggregate }),
			...(sameAttention(attention, current.attention) ? {} : { attention })
		});
	};

	const refreshEnvironment = async (environmentID: string, forGeneration: number) => {
		if (!client) return;
		try {
			const snapshot: DashboardSnapshot = await client.dashboard.snapshot({ envID: environmentID });
			if (forGeneration !== generation || !get().statesByEnvironmentID[environmentID]) return;
			commit(applySnapshot(get().statesByEnvironmentID, environmentID, snapshot));
		} catch (error) {
			if (forGeneration !== generation || !get().statesByEnvironmentID[environmentID]) return;
			if (isCancellation(error)) return;
			commit(
				applyError(
					get().statesByEnvironmentID,
					environmentID,
					friendlyErrorMessage(error),
					undefined
				)
			);
		}
	};

	const apply = (event: DashboardStreamEvent) => {
		const environmentID = DashboardStreamEvent.resolvedEnvironmentID(event);
		switch (event.type) {
			case 'snapshot':
				if (event.snapshot)
					commit(applySnapshot(get().statesByEnvironmentID, environmentID, event.snapshot));
				break;
			case 'error':
				commit(
					applyError(
						get().statesByEnvironmentID,
						environmentID,
						event.error,
						event.errorCode as DashboardStreamErrorCode | undefined
					)
				);
				break;
			default:
				break;
		}
	};

	const runStreamLoop = async (
		streamClient: ArcaneClient,
		forGeneration: number,
		controller: AbortController
	) => {
		const signal = controller.signal;
		const scoped = streamClient.withSignal(signal);
		let attempt = 0;
		try {
			while (!signal.aborted && forGeneration === generation) {
				commit(invalidateSnapshots(get().statesByEnvironmentID));
				const connectedAt = Date.now();
				let receivedFirstEvent = false;
				try {
					for await (const event of scoped.dashboard.stream()) {
						if (forGeneration !== generation || signal.aborted) return;
						if (!receivedFirstEvent) {
							receivedFirstEvent = true;
							set({ connected: true, streamFailed: false });
							// A fresh stream re-emits errors for environments still failing.
							commit(clearAllStreamErrors(get().statesByEnvironmentID));
						}
						apply(event);
					}
				} catch (error) {
					if (isArcaneError(error, 'notFound')) {
						// Server predates the stream endpoint: silent legacy mode.
						set({ streamUnsupported: true, connected: false });
						await get().refresh();
						return;
					}
					if (isCancellation(error) || signal.aborted) return;
					// Transport drops, server restarts, undecodable lines: all retried below.
				}

				set({ connected: false });
				commit(invalidateSnapshots(get().statesByEnvironmentID));
				if (forGeneration !== generation || signal.aborted) return;

				if (
					receivedFirstEvent &&
					Date.now() - connectedAt >= StreamBackoff.stableConnectionSeconds * 1000
				) {
					attempt = 0;
				}
				const next = nextReconnect(attempt);
				attempt = next.attempt;
				if (next.exhausted) set({ streamFailed: true });
				await sleep(next.delay, signal);
			}
		} finally {
			if (forGeneration === generation && streamTask === controller) {
				streamTask = undefined;
				set({ connected: false });
			}
		}
	};

	return {
		statesByEnvironmentID: {},
		connected: false,
		streamFailed: false,
		streamUnsupported: false,
		aggregate: undefined,
		attention: emptyAttention,

		isStreaming: () => streamTask !== undefined,

		state: (environmentID) => get().statesByEnvironmentID[environmentID],

		configure: (next) => {
			const identity = next?.transport;
			if (identity === clientIdentity) return;
			get().stop();
			clientIdentity = identity;
			client = next;
			set({
				statesByEnvironmentID: {},
				aggregate: undefined,
				attention: emptyAttention,
				streamUnsupported: false,
				streamFailed: false
			});
		},

		/** Idempotent: a live stream task is left alone. */
		start: () => {
			shouldRun = true;
			if (!client || get().streamUnsupported || streamTask) return;
			commit(invalidateSnapshots(get().statesByEnvironmentID));
			generation += 1;
			const controller = new AbortController();
			streamTask = controller;
			void runStreamLoop(client, generation, controller);
		},

		stop: () => {
			shouldRun = false;
			generation += 1;
			streamTask?.abort();
			streamTask = undefined;
			// Environment states are intentionally kept: last-known data keeps rendering.
			set({ connected: false, streamFailed: false });
		},

		retry: () => {
			if (!shouldRun) return;
			get().stop();
			commit(clearAllStreamErrors(get().statesByEnvironmentID));
			get().start();
		},

		reconnect: () => get().retry(),

		reconcile: (environments) => {
			const { states, added } = reconcileStates(get().statesByEnvironmentID, environments);
			commit(states);
			// Only environments added mid-connection need a one-shot snapshot; a
			// connection still opening delivers every environment it serves.
			if (streamTask && get().connected) {
				const forGeneration = generation;
				for (const id of added) void refreshEnvironment(id, forGeneration);
			}
		},

		refresh: async (environmentIDs) => {
			const forGeneration = generation;
			const states = get().statesByEnvironmentID;
			const ids = environmentIDs?.filter((id) => states[id] !== undefined) ?? Object.keys(states);
			await Promise.all(ids.map((id) => refreshEnvironment(id, forGeneration)));
		}
	};
});

/** Reactive state for one environment card. */
export function useDashboardEnvironmentState(
	environmentID: string
): DashboardEnvironmentState | undefined {
	return useDashboardStreamStore((s) => s.statesByEnvironmentID[environmentID]);
}
