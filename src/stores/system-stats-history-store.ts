/**
 * Port of `SystemStatsHistoryStore.swift`: owns the per-environment
 * `system/stats` WebSocket streams for the dashboard and keeps a rolling
 * sample window per environment, so sparklines and the usage chart survive
 * view updates without restarting their history. Same lifecycle as
 * `DashboardStreamStore`; owned by `EnvironmentsStore`.
 */
import { create } from 'zustand';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { storage } from '@/core/storage';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';

import {
	appendFrame,
	emptySeries,
	LiveStatsLimit,
	nextReconnect,
	StreamBackoff,
	type StatsSeries
} from './dashboard-stream-logic';

/** Streams are opened for at most this many environments (dashboard order, active first). */
export function maxStatsStreams(): number {
	return LiveStatsLimit.maxStreams(storage.number(LiveStatsLimit.preferenceKey));
}

type SystemStatsHistoryState = {
	seriesByEnvironmentID: Readonly<Record<string, StatsSeries>>;

	series: (environmentID: string) => StatsSeries | undefined;
	configure: (client: ArcaneClient | undefined) => void;
	reconcile: (environments: Environment[]) => void;
	start: () => void;
	stop: () => void;
	/** Re-applies the stream cap after the App Settings limit changes. */
	applyStreamLimit: () => void;
	reconnect: () => void;
};

const sleep = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true }
		);
	});

export const useSystemStatsHistoryStore = create<SystemStatsHistoryState>((set, get) => {
	let client: ArcaneClient | undefined;
	let clientIdentity: object | undefined;
	/** Dashboard-ordered enabled environment IDs; the first `maxStatsStreams()` stream. */
	let trackedIDs: string[] = [];
	const tasks = new Map<string, AbortController>();
	let generation = 0;
	let isRunning = false;
	let lastReconnectAt: number | undefined;

	const update = (environmentID: string, transform: (series: StatsSeries) => StatsSeries) => {
		const current = get().seriesByEnvironmentID[environmentID] ?? emptySeries;
		const next = transform(current);
		if (next === current) return;
		set((s) => ({ seriesByEnvironmentID: { ...s.seriesByEnvironmentID, [environmentID]: next } }));
	};

	const setError = (environmentID: string, message: string) =>
		update(environmentID, (s) => ({ ...s, error: message }));
	const clearError = (environmentID: string) =>
		update(environmentID, (s) => (s.error === undefined ? s : { ...s, error: undefined }));

	const runStream = async (
		environmentID: string,
		streamClient: ArcaneClient,
		forGeneration: number,
		controller: AbortController
	) => {
		const signal = controller.signal;
		// Brief stagger so a dashboard full of cards doesn't open every stream at once.
		await sleep(150, signal);
		if (signal.aborted || forGeneration !== generation) return;
		const scoped = streamClient.withSignal(signal);
		let attempt = 0;
		try {
			while (!signal.aborted && forGeneration === generation) {
				const connectedAt = Date.now();
				let receivedFirstFrame = false;
				try {
					// Each iteration opens a fresh WebSocket channel.
					for await (const frame of scoped.system.statsStream({ envID: environmentID })) {
						if (forGeneration !== generation || signal.aborted) return;
						if (!receivedFirstFrame) {
							receivedFirstFrame = true;
							clearError(environmentID);
						}
						if (trackedIDs.includes(environmentID))
							update(environmentID, (s) => appendFrame(s, frame, Date.now()));
					}
				} catch (error) {
					if (forGeneration !== generation || signal.aborted) return;
					if (isCancellation(error)) {
						setError(environmentID, 'Live stats unavailable: Connection interrupted');
					} else {
						// Keep the last-known series; flag the error while backing off.
						setError(environmentID, `Live stats unavailable: ${friendlyErrorMessage(error)}`);
						// A rejected handshake (expired bearer, connection cap) never reaches the
						// HTTP 401-refresh path; force a refresh so the next attempt carries a live token.
						const handshakeFailed =
							!receivedFirstFrame &&
							isArcaneError(error, 'transport') &&
							!String(error.message).startsWith('WebSocket closed');
						if (
							handshakeFailed &&
							(await streamClient.authManager.hasRefreshCredential().catch(() => false))
						) {
							if (forGeneration !== generation || signal.aborted) return;
							await streamClient.authManager.refreshTokens().catch(() => undefined);
						}
					}
				}
				if (forGeneration !== generation || signal.aborted) return;
				if (
					receivedFirstFrame &&
					Date.now() - connectedAt >= StreamBackoff.stableConnectionSeconds * 1000
				)
					attempt = 0;
				const next = nextReconnect(attempt);
				attempt = next.attempt;
				await sleep(next.delay * 1000, signal);
			}
		} finally {
			if (forGeneration === generation && tasks.get(environmentID) === controller)
				tasks.delete(environmentID);
		}
	};

	const reconcileTasks = () => {
		if (!isRunning || !client) return;
		const wanted = new Set(trackedIDs.slice(0, maxStatsStreams()));
		for (const [id, controller] of tasks) {
			if (!wanted.has(id)) {
				controller.abort();
				tasks.delete(id);
			}
		}
		for (const id of wanted) {
			if (tasks.has(id)) continue;
			const controller = new AbortController();
			tasks.set(id, controller);
			void runStream(id, client, generation, controller);
		}
	};

	return {
		seriesByEnvironmentID: {},

		series: (environmentID) => get().seriesByEnvironmentID[environmentID],

		configure: (next) => {
			const identity = next?.transport;
			if (identity === clientIdentity) return;
			get().stop();
			clientIdentity = identity;
			client = next;
			trackedIDs = [];
			set({ seriesByEnvironmentID: {} });
		},

		reconcile: (environments) => {
			trackedIDs = environments.filter((e) => e.enabled).map((e) => e.id);
			const target = new Set(trackedIDs);
			const current = get().seriesByEnvironmentID;
			const next: Record<string, StatsSeries> = {};
			for (const id of trackedIDs) next[id] = current[id] ?? emptySeries;
			const changed =
				Object.keys(current).some((id) => !target.has(id)) ||
				trackedIDs.some((id) => current[id] === undefined);
			if (changed) set({ seriesByEnvironmentID: next });
			if (isRunning) reconcileTasks();
		},

		start: () => {
			if (isRunning) return;
			isRunning = true;
			generation += 1;
			reconcileTasks();
		},

		stop: () => {
			isRunning = false;
			generation += 1;
			for (const controller of tasks.values()) controller.abort();
			tasks.clear();
			// Series are intentionally kept: last-known data keeps rendering.
		},

		applyStreamLimit: () => {
			if (isRunning) reconcileTasks();
		},

		reconnect: () => {
			if (!isRunning) return;
			// Rapid pull-to-refresh would stack still-closing sockets against the
			// server's per-IP connection cap; ignore reconnects inside 2s.
			if (lastReconnectAt !== undefined && Date.now() - lastReconnectAt < 2000) return;
			lastReconnectAt = Date.now();
			get().stop();
			get().start();
		}
	};
});

/** Reactive series for one environment. */
export function useStatsSeries(environmentID: string): StatsSeries | undefined {
	return useSystemStatsHistoryStore((s) => s.seriesByEnvironmentID[environmentID]);
}
