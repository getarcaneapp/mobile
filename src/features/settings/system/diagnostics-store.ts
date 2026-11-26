import { createStore, type StoreApi } from 'zustand';

import { deepEqual } from '@/core/deep-equal';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { EnvironmentID } from '@/sdk/client/environment';
import type {
	ActorDiagnostics,
	DiagnosticsSnapshot,
	GoroutineProfile,
	ServerLogEntry
} from '@/sdk/models/diagnostics/Diagnostics';
import { nextReconnect, StreamBackoff } from '@/stores/dashboard-stream-logic';

import { appendLogRows, attrsText, type DiagnosticLogRow } from './diagnostics-model';

export type DiagnosticsState = {
	snapshot: DiagnosticsSnapshot | undefined;
	snapshotError: string | undefined;
	isPaused: boolean;
	actors: ActorDiagnostics[] | undefined;
	actorsError: string | undefined;
	logs: readonly DiagnosticLogRow[];
	logsError: string | undefined;
	goroutines: GoroutineProfile | undefined;
	goroutinesError: string | undefined;
	isLoadingGoroutines: boolean;

	setPaused: (paused: boolean) => void;
	clearLogs: () => void;
	connectSnapshot: (client: ArcaneClient) => () => void;
	connectActors: (client: ArcaneClient) => () => void;
	connectLogs: (client: ArcaneClient) => () => void;
	loadGoroutines: (client: ArcaneClient) => Promise<void>;
};

export type DiagnosticsStore = StoreApi<DiagnosticsState>;

const logFlushMs = 250;

const wait = (ms: number, signal: AbortSignal) =>
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

async function consume<Element>(
	stream: AsyncIterable<Element>,
	signal: AbortSignal,
	onValue: (value: Element) => void
): Promise<{ received: boolean; error?: string }> {
	let received = false;
	try {
		for await (const value of stream) {
			if (signal.aborted) break;
			received = true;
			onValue(value);
		}
		return { received };
	} catch (error) {
		if (signal.aborted || isCancellation(error)) return { received };
		return { received, error: friendlyErrorMessage(error) };
	}
}

async function followStream<Element>(
	open: (client: ArcaneClient) => AsyncIterable<Element>,
	client: ArcaneClient,
	signal: AbortSignal,
	onValue: (value: Element) => void,
	onError: (message: string) => void,
	onAttempt?: () => void
) {
	const scoped = client.withSignal(signal);
	let attempt = 0;
	while (!signal.aborted) {
		const startedAt = Date.now();
		onAttempt?.();
		const result = await consume(open(scoped), signal, onValue);
		if (signal.aborted) return;
		onError(result.error ?? 'Disconnected');
		if (result.received && Date.now() - startedAt >= StreamBackoff.stableConnectionSeconds * 1000)
			attempt = 0;
		const next = nextReconnect(attempt);
		attempt = next.attempt;
		await wait(next.delay * 1000, signal);
	}
}

async function fetchGoroutines(
	client: ArcaneClient
): Promise<{ profile: GoroutineProfile } | { message: string }> {
	try {
		return {
			profile: await client.diagnostics.goroutines({ envID: EnvironmentID.localDocker })
		};
	} catch (error) {
		return { message: friendlyErrorMessage(error) };
	}
}

export function createDiagnosticsStore(): DiagnosticsStore {
	let nextLogID = 0;
	let goroutineGeneration = 0;

	return createStore<DiagnosticsState>((set, get) => ({
		snapshot: undefined,
		snapshotError: undefined,
		isPaused: false,
		actors: undefined,
		actorsError: undefined,
		logs: [],
		logsError: undefined,
		goroutines: undefined,
		goroutinesError: undefined,
		isLoadingGoroutines: false,

		setPaused: (paused) => set({ isPaused: paused }),

		clearLogs: () => set({ logs: [] }),

		connectSnapshot: (client) => {
			const controller = new AbortController();
			void followStream(
				(scoped) => scoped.diagnostics.snapshotStream(),
				client,
				controller.signal,
				(message) => {
					if (message.type !== 'snapshot') return;
					if (get().isPaused) return;
					set({ snapshot: message.snapshot, snapshotError: undefined });
				},
				(error) => set({ snapshotError: error })
			);
			return () => controller.abort();
		},

		connectActors: (client) => {
			const controller = new AbortController();
			void followStream(
				(scoped) => scoped.diagnostics.actorsStream(),
				client,
				controller.signal,
				(actors) => {
					const state = get();
					if (state.actors && deepEqual(state.actors, actors)) {
						if (state.actorsError !== undefined) set({ actorsError: undefined });
						return;
					}
					set({ actors, actorsError: undefined });
				},
				(error) => set({ actorsError: error })
			);
			return () => controller.abort();
		},

		connectLogs: (client) => {
			const controller = new AbortController();
			let pending: DiagnosticLogRow[] = [];
			let timer: ReturnType<typeof setTimeout> | undefined;
			const flush = () => {
				timer = undefined;
				if (controller.signal.aborted || pending.length === 0) return;
				const batch = pending;
				pending = [];
				set((state) => ({ logs: appendLogRows(state.logs, batch), logsError: undefined }));
			};
			void followStream(
				(scoped) => scoped.diagnostics.logsStream(),
				client,
				controller.signal,
				(entry: ServerLogEntry) => {
					nextLogID += 1;
					pending.push({ id: nextLogID, entry, attrs: attrsText(entry.attrs) });
					timer ??= setTimeout(flush, logFlushMs);
				},
				(error) => set({ logsError: error }),
				() => {
					pending = [];
					set({ logs: [] });
				}
			);
			return () => {
				controller.abort();
				if (timer !== undefined) clearTimeout(timer);
			};
		},

		loadGoroutines: async (client) => {
			goroutineGeneration += 1;
			const generation = goroutineGeneration;
			set({ isLoadingGoroutines: true });
			const result = await fetchGoroutines(client);
			if (generation !== goroutineGeneration) return;
			if ('profile' in result)
				set({ goroutines: result.profile, goroutinesError: undefined, isLoadingGoroutines: false });
			else set({ goroutinesError: result.message, isLoadingGoroutines: false });
		}
	}));
}
