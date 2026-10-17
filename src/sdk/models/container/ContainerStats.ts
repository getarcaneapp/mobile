/** Port of Models/Container/ContainerStats.swift. */
import type { JSONObject, JSONValue } from '../../types/json';
import { D } from '../base/decoding';

/** Compact history sample for container CPU and memory usage. */
export interface ContainerStatsHistorySample {
	cpuTenths: number;
	memoryTenths: number;
	memoryUsageBytes: number;
}

export const ContainerStatsHistorySample = {
	make(init: Partial<ContainerStatsHistorySample> = {}): ContainerStatsHistorySample {
		return {
			cpuTenths: init.cpuTenths ?? 0,
			memoryTenths: init.memoryTenths ?? 0,
			memoryUsageBytes: init.memoryUsageBytes ?? 0
		};
	},

	/** Synthesized Swift decoding: every field is required. */
	decode(raw: unknown): ContainerStatsHistorySample {
		const o = D.object(raw, 'ContainerStatsHistorySample');
		return {
			cpuTenths: D.int(o, 'cpuTenths'),
			memoryTenths: D.int(o, 'memoryTenths'),
			memoryUsageBytes: D.int(o, 'memoryUsageBytes')
		};
	}
} as const;

/**
 * Container stats websocket payload. Mirrors Docker's StatsResponse (embedded)
 * plus Arcane-added history. The Docker portion is exposed as raw JSON so we
 * stay forward-compatible with the upstream schema.
 */
export interface ContainerStatsPayload {
	/** Raw Docker stats fields (anything not under `statsHistory` / `currentHistorySample`). */
	raw: Record<string, JSONValue>;
	statsHistory?: ContainerStatsHistorySample[];
	currentHistorySample: ContainerStatsHistorySample;
}

const knownKeys: ReadonlySet<string> = new Set(['statsHistory', 'currentHistorySample']);

export const ContainerStatsPayload = {
	knownKeys,

	make(this: void, init: Partial<ContainerStatsPayload> = {}): ContainerStatsPayload {
		return {
			raw: init.raw ?? {},
			statsHistory: init.statsHistory,
			currentHistorySample: init.currentHistorySample ?? ContainerStatsHistorySample.make()
		};
	},

	/** Swift `init(from:)`: splits the Arcane history fields from the raw Docker stats. */
	decode(this: void, raw: unknown): ContainerStatsPayload {
		const object = D.object(raw, 'ContainerStatsPayload') as JSONObject;
		const history = object['statsHistory'];
		const statsHistory = Array.isArray(history)
			? history.map((item) => ContainerStatsHistorySample.decode(item))
			: undefined;
		const sample = object['currentHistorySample'];
		const currentHistorySample =
			sample !== undefined
				? ContainerStatsHistorySample.decode(sample)
				: ContainerStatsHistorySample.make();
		const rest: Record<string, JSONValue> = {};
		for (const [key, value] of Object.entries(object)) {
			if (!knownKeys.has(key)) rest[key] = value;
		}
		return { raw: rest, statsHistory, currentHistorySample };
	},

	/** Swift `encode(to:)`: merges the history fields back into the raw object. */
	encode(this: void, value: ContainerStatsPayload): Record<string, unknown> {
		const merged: Record<string, unknown> = { ...value.raw };
		if (value.statsHistory !== undefined) merged['statsHistory'] = value.statsHistory;
		merged['currentHistorySample'] = value.currentHistorySample;
		return merged;
	}
} as const;
