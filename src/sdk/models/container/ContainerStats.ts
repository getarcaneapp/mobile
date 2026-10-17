import type { JSONObject, JSONValue } from '../../types/json';
import { D } from '../base/decoding';

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

	decode(raw: unknown): ContainerStatsHistorySample {
		const o = D.object(raw, 'ContainerStatsHistorySample');
		return {
			cpuTenths: D.int(o, 'cpuTenths'),
			memoryTenths: D.int(o, 'memoryTenths'),
			memoryUsageBytes: D.int(o, 'memoryUsageBytes')
		};
	}
} as const;

export interface ContainerStatsPayload {
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

	encode(this: void, value: ContainerStatsPayload): Record<string, unknown> {
		const merged: Record<string, unknown> = { ...value.raw };
		if (value.statsHistory !== undefined) merged['statsHistory'] = value.statsHistory;
		merged['currentHistorySample'] = value.currentHistorySample;
		return merged;
	}
} as const;
