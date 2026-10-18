import { formatFileBytes, nonnegative, saturatingAdd } from '@/core/networking/remote-data-limits';

export interface ContainerStatsFrame {
	timestamp: number;
	cpuPercent: number;
	memoryUsed: number;
	memoryLimit: number;
	memoryPercent: number;
	netRxBytes: number;
	netTxBytes: number;
	netRxPerSec: number;
	netTxPerSec: number;
	blockReadBytes: number;
	blockWriteBytes: number;
	blockReadPerSec: number;
	blockWritePerSec: number;
}

type JSONObject = Record<string, unknown>;

const asObject = (value: unknown): JSONObject | undefined =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as JSONObject)
		: undefined;
const asArray = (value: unknown): unknown[] | undefined =>
	Array.isArray(value) ? value : undefined;
const asInt = (value: unknown): number | undefined =>
	typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined;
const asString = (value: unknown): string | undefined =>
	typeof value === 'string' ? value : undefined;

const maxValue = Number.MAX_SAFE_INTEGER;
const rateCap = 1_000_000_000_000_000;

function nonnegativeDelta(current: number, previous: number): number {
	const delta = current - previous;
	return Number.isFinite(delta) && delta > 0 ? delta : 0;
}

function safeNonnegativeSubtract(lhs: number, rhs: number): number {
	return Math.max(nonnegative(lhs, maxValue) - nonnegative(rhs, maxValue), 0);
}

function rate(current: number, previous: number | undefined, duration: number): number {
	if (previous === undefined) return 0;
	const value = nonnegativeDelta(current, previous) / duration;
	return Number.isFinite(value) ? Math.min(Math.max(value, 0), rateCap) : 0;
}

export function parseContainerStatsFrame(
	json: unknown,
	previous: ContainerStatsFrame | undefined,
	now: number = Date.now()
): ContainerStatsFrame | undefined {
	const root = asObject(json);
	if (!root) return undefined;

	const cpu = asObject(root['cpu_stats']) ?? {};
	const pre = asObject(root['precpu_stats']) ?? {};
	const cpuTotal = asInt(asObject(cpu['cpu_usage'])?.['total_usage']) ?? 0;
	const preTotal = asInt(asObject(pre['cpu_usage'])?.['total_usage']) ?? 0;
	const sysTotal = asInt(cpu['system_cpu_usage']) ?? 0;
	const preSys = asInt(pre['system_cpu_usage']) ?? 0;
	const online =
		asInt(cpu['online_cpus']) ?? asArray(asObject(cpu['cpu_usage'])?.['percpu_usage'])?.length ?? 1;

	const cpuDelta = nonnegativeDelta(cpuTotal, preTotal);
	const sysDelta = nonnegativeDelta(sysTotal, preSys);
	const rawCPUPercent =
		sysDelta > 0 && cpuDelta > 0 ? (cpuDelta / sysDelta) * Math.max(online, 1) * 100 : 0;
	const cpuPercent = Number.isFinite(rawCPUPercent)
		? Math.min(Math.max(rawCPUPercent, 0), 100_000)
		: 0;

	const mem = asObject(root['memory_stats']) ?? {};
	const usage = asInt(mem['usage']) ?? 0;
	const memStats = asObject(mem['stats']);
	const cache = asInt(memStats?.['cache']) ?? asInt(memStats?.['inactive_file']) ?? 0;
	const memoryUsed = safeNonnegativeSubtract(usage, cache);
	const memoryLimit = nonnegative(asInt(mem['limit']) ?? 0, maxValue);
	const rawMemoryPercent = memoryLimit > 0 ? (memoryUsed / memoryLimit) * 100 : 0;
	const memoryPercent = Number.isFinite(rawMemoryPercent)
		? Math.min(Math.max(rawMemoryPercent, 0), 100_000)
		: 0;

	let rx = 0;
	let tx = 0;
	const nets = asObject(root['networks']);
	if (nets) {
		for (const ifc of Object.values(nets).slice(0, 1_024)) {
			rx = saturatingAdd(rx, asInt(asObject(ifc)?.['rx_bytes']) ?? 0, maxValue);
			tx = saturatingAdd(tx, asInt(asObject(ifc)?.['tx_bytes']) ?? 0, maxValue);
		}
	}

	let blockRead = 0;
	let blockWrite = 0;
	const entries = asArray(asObject(root['blkio_stats'])?.['io_service_bytes_recursive']);
	if (entries) {
		for (const entry of entries.slice(0, 1_024)) {
			const op = (asString(asObject(entry)?.['op']) ?? '').toLowerCase();
			const value = asInt(asObject(entry)?.['value']) ?? 0;
			if (op === 'read') blockRead = saturatingAdd(blockRead, value, maxValue);
			else if (op === 'write') blockWrite = saturatingAdd(blockWrite, value, maxValue);
		}
	}

	const dt = previous ? (now - previous.timestamp) / 1000 : 1;
	const safeDt = Number.isFinite(dt) ? Math.max(dt, 0.001) : 1;

	return {
		timestamp: now,
		cpuPercent,
		memoryUsed,
		memoryLimit,
		memoryPercent,
		netRxBytes: rx,
		netTxBytes: tx,
		netRxPerSec: rate(rx, previous?.netRxBytes, safeDt),
		netTxPerSec: rate(tx, previous?.netTxBytes, safeDt),
		blockReadBytes: blockRead,
		blockWriteBytes: blockWrite,
		blockReadPerSec: rate(blockRead, previous?.blockReadBytes, safeDt),
		blockWritePerSec: rate(blockWrite, previous?.blockWriteBytes, safeDt)
	};
}

export interface ContainerStatsChartSeries {
	cpu: number[];
	memoryBytes: number[];
	networkReceive: number[];
	networkTransmit: number[];
	blockRead: number[];
	blockWrite: number[];
}

export function chartSeries(frames: readonly ContainerStatsFrame[]): ContainerStatsChartSeries {
	return {
		cpu: frames.map((f) => f.cpuPercent),
		memoryBytes: frames.map((f) => f.memoryUsed),
		networkReceive: frames.map((f) => f.netRxPerSec),
		networkTransmit: frames.map((f) => f.netTxPerSec),
		blockRead: frames.map((f) => f.blockReadPerSec),
		blockWrite: frames.map((f) => f.blockWritePerSec)
	};
}

export function appendFrame(
	frames: readonly ContainerStatsFrame[],
	frame: ContainerStatsFrame,
	windowSize = 60
) {
	const next = [...frames, frame];
	return next.length > windowSize ? next.slice(next.length - windowSize) : next;
}

export const StatsText = {
	percent: (value: number | undefined) => (value === undefined ? '—' : `${value.toFixed(1)}%`),
	memory: (used: number | undefined) => (used === undefined ? '—' : formatFileBytes(used)),
	rate(bytesPerSec: number | undefined) {
		if (bytesPerSec === undefined || !Number.isFinite(bytesPerSec)) return '—';
		return `${formatFileBytes(Math.trunc(Math.min(Math.max(0, bytesPerSec), 1_000_000_000_000_000)))}/s`;
	}
};

export type StatsAxisUnit = 'percent' | 'bytes' | 'bytesPerSecond';

function axisDecimals(step: number) {
	return step > 0 && step < 1 ? Math.min(Math.ceil(-Math.log10(step) - 1e-9) + 1, 6) : 1;
}

export function axisBytes(value: number): string {
	if (!(value > 0) || !Number.isFinite(value)) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
	let scaled = value;
	let unit = 0;
	while (unit < units.length - 1 && scaled >= 1_000) {
		scaled /= 1_000;
		unit += 1;
	}
	return `${+scaled.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function statsAxisLabel(value: number, step: number, unit: StatsAxisUnit): string {
	if (unit === 'percent') return `${+value.toFixed(axisDecimals(step))}%`;
	const bytes = axisBytes(value);
	return unit === 'bytesPerSecond' ? `${bytes}/s` : bytes;
}
