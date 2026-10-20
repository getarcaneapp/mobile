import { Platform } from 'react-native';

import {
	ArcaneWidgetBridge,
	type LiveActivityAttributes,
	type LiveActivityContentState
} from '../../modules/arcane-widget-bridge';

export type LiveActivityProgress = { phase: string; progress?: number };
export type LiveActivityOutcome = 'success' | 'failure' | 'cancelled';

type Entry = {
	key: string;
	id: Promise<string | undefined>;
	tail: Promise<void>;
	sent: LiveActivityContentState;
	sentAt: number;
	pending?: LiveActivityContentState;
	timer?: ReturnType<typeof setTimeout>;
};

const minimumUpdateIntervalMs = 1000;
const lingerSeconds: Record<LiveActivityOutcome, number> = {
	success: 4,
	failure: 8,
	cancelled: 4
};
const outcomePhase: Record<LiveActivityOutcome, string> = {
	success: 'Complete',
	failure: 'Failed',
	cancelled: 'Cancelled'
};

let current: Entry | undefined;

const isSupported = () => Platform.OS === 'ios' && ArcaneWidgetBridge.isLinked;

function normalizedProgress(progress: number | undefined): number | undefined {
	if (progress === undefined || !Number.isFinite(progress)) return undefined;
	return Math.min(Math.max(progress, 0), 1);
}

function enqueue(entry: Entry, work: (id: string) => Promise<void>) {
	entry.tail = entry.tail
		.then(async () => {
			const id = await entry.id;
			if (id !== undefined) await work(id);
		})
		.catch(() => {});
}

function clearPending(entry: Entry) {
	if (entry.timer) clearTimeout(entry.timer);
	entry.timer = undefined;
	entry.pending = undefined;
}

function send(entry: Entry, state: LiveActivityContentState) {
	clearPending(entry);
	entry.sent = state;
	entry.sentAt = Date.now();
	enqueue(entry, (id) => ArcaneWidgetBridge.updateActivity(id, state));
}

function flushPending(entry: Entry) {
	entry.timer = undefined;
	const pending = entry.pending;
	if (pending && current === entry) send(entry, pending);
}

function end(entry: Entry, state: LiveActivityContentState | undefined, linger: number) {
	clearPending(entry);
	if (current === entry) current = undefined;
	enqueue(entry, (id) => ArcaneWidgetBridge.endActivity(id, state, linger));
}

export const LiveActivities = {
	start(key: string, attributes: LiveActivityAttributes, initial: LiveActivityProgress) {
		if (!isSupported()) return;
		if (current) end(current, undefined, 0);
		const state: LiveActivityContentState = {
			phase: initial.phase,
			progress: normalizedProgress(initial.progress),
			state: 'running'
		};
		const id = ArcaneWidgetBridge.areActivitiesEnabled()
			? ArcaneWidgetBridge.startActivity(attributes, state).catch(() => undefined)
			: Promise.resolve(undefined);
		current = { key, id, tail: Promise.resolve(), sent: state, sentAt: Date.now() };
	},

	update(key: string, update: LiveActivityProgress) {
		const entry = current;
		if (!entry || entry.key !== key) return;
		const state: LiveActivityContentState = {
			phase: update.phase,
			progress: normalizedProgress(update.progress),
			state: 'running'
		};
		const latest = entry.pending ?? entry.sent;
		if (latest.phase === state.phase && latest.progress === state.progress) return;
		const elapsed = Date.now() - entry.sentAt;
		if (state.phase !== entry.sent.phase || elapsed >= minimumUpdateIntervalMs) {
			send(entry, state);
			return;
		}
		entry.pending = state;
		entry.timer ??= setTimeout(() => flushPending(entry), minimumUpdateIntervalMs - elapsed);
	},

	finish(key: string, outcome: LiveActivityOutcome, progress?: number) {
		const entry = current;
		if (!entry || entry.key !== key) return;
		end(
			entry,
			{
				phase: outcomePhase[outcome],
				progress: outcome === 'success' ? 1 : normalizedProgress(progress),
				state: outcome === 'success' ? 'success' : 'failure'
			},
			lingerSeconds[outcome]
		);
	},

	endAll() {
		if (!isSupported()) return;
		if (current) clearPending(current);
		current = undefined;
		void ArcaneWidgetBridge.endAllActivities().catch(() => {});
	}
};
