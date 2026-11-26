import { formattedISO8601 } from '@/core/date-formatting';
import { formatFileBytes } from '@/core/networking/remote-data-limits';
import {
	GoroutineProfile,
	type ActorTypeInfo,
	type DiagnosticsMemory,
	type DiagnosticsSnapshot,
	type GoroutineGroup,
	type ServerLogEntry
} from '@/sdk/models/diagnostics/Diagnostics';

export type DiagnosticsTab = 'overview' | 'connections' | 'actors' | 'goroutines' | 'logs';

export const diagnosticsTabs: { value: DiagnosticsTab; title: string; systemImage: string }[] = [
	{ value: 'overview', title: 'Overview', systemImage: 'cpu' },
	{ value: 'connections', title: 'Connections', systemImage: 'dot.radiowaves.left.and.right' },
	{ value: 'actors', title: 'Actors', systemImage: 'server.rack' },
	{ value: 'goroutines', title: 'Goroutines', systemImage: 'square.stack.3d.up' },
	{ value: 'logs', title: 'Logs', systemImage: 'list.bullet.rectangle' }
];

export type DiagnosticRow = { label: string; value: string };

const countFormatter = new Intl.NumberFormat();

export function formatCount(value: number): string {
	return countFormatter.format(value);
}

export function formatBytes(value: number): string {
	return value > 0 ? formatFileBytes(value) : '0 B';
}

export function formatUptime(totalSeconds: number): string {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	if (seconds < 60) return `${seconds}s`;
	const days = Math.floor(seconds / 86_400);
	const hours = Math.floor((seconds % 86_400) / 3_600);
	const minutes = Math.floor((seconds % 3_600) / 60);
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m ${seconds % 60}s`;
}

export function formatPauseNs(nanoseconds: number): string {
	const milliseconds = nanoseconds / 1e6;
	return milliseconds < 1 ? `${(nanoseconds / 1e3).toFixed(0)}µs` : `${milliseconds.toFixed(2)}ms`;
}

export function formatDiagnosticTime(value: string | undefined): string {
	if (!value || value.startsWith('0001-01-01')) return '—';
	return formattedISO8601(value, 'abbreviated', 'standard');
}

export function leakedGoroutinesValue(snapshot: DiagnosticsSnapshot): string {
	const { runtime } = snapshot;
	if (runtime.leakScannedAt || runtime.leakedGoroutines > 0)
		return formatCount(runtime.leakedGoroutines);
	return 'Not scanned';
}

export function runtimeRows(snapshot: DiagnosticsSnapshot): DiagnosticRow[] {
	const { runtime } = snapshot;
	return [
		{ label: 'Go Version', value: runtime.goVersion || '—' },
		{ label: 'Platform', value: runtime.os ? `${runtime.os}/${runtime.arch}` : '—' },
		{ label: 'GOMAXPROCS', value: formatCount(runtime.gomaxprocs) },
		{ label: 'CPUs', value: formatCount(runtime.numCpu) },
		{ label: 'Goroutines', value: formatCount(runtime.goroutines) },
		{ label: 'Leaked Goroutines', value: leakedGoroutinesValue(snapshot) },
		{ label: 'WebSocket Workers', value: formatCount(runtime.wsWorkerGoroutines) },
		{ label: 'Cgo Calls', value: formatCount(runtime.numCgoCall) },
		{ label: 'Uptime', value: formatUptime(runtime.uptimeSeconds) }
	];
}

export function memoryRows(memory: DiagnosticsMemory): DiagnosticRow[] {
	return [
		{ label: 'Heap Allocated', value: formatBytes(memory.heapAlloc) },
		{ label: 'Heap Reserved', value: formatBytes(memory.heapSys) },
		{ label: 'Heap Objects', value: formatCount(memory.heapObjects) },
		{ label: 'Stack In Use', value: formatBytes(memory.stackInuse) },
		{ label: 'Total Allocated', value: formatBytes(memory.totalAlloc) },
		{ label: 'System Total', value: formatBytes(memory.sys) },
		{ label: 'Next GC', value: formatBytes(memory.nextGc) },
		{ label: 'GC CPU', value: `${(memory.gcCpuFraction * 100).toFixed(3)}%` }
	];
}

export function gcRows(snapshot: DiagnosticsSnapshot): DiagnosticRow[] {
	const rows: DiagnosticRow[] = [
		{ label: 'Total Cycles', value: formatCount(snapshot.gc.numGc) },
		{ label: 'Forced Cycles', value: formatCount(snapshot.memory.numForcedGc) },
		{ label: 'Total Pause', value: formatPauseNs(snapshot.gc.pauseTotalNs) },
		{ label: 'Last GC', value: formatDiagnosticTime(snapshot.gc.lastGc) }
	];
	const pauses = snapshot.gc.recentPausesNs;
	if (pauses.length > 0)
		rows.push({
			label: 'Longest Recent Pause',
			value: formatPauseNs(pauses.reduce((largest, value) => Math.max(largest, value), 0))
		});
	return rows;
}

export type HeapSegments = { inUse: number; idle: number; released: number };

export function heapSegments(memory: DiagnosticsMemory): HeapSegments | undefined {
	if (memory.heapSys <= 0) return undefined;
	const released = Math.max(0, memory.heapReleased);
	const idle = Math.max(0, memory.heapIdle - released);
	const inUse = Math.max(0, memory.heapInuse);
	const total = memory.heapSys;
	return {
		inUse: Math.min(1, inUse / total),
		idle: Math.min(1, idle / total),
		released: Math.min(1, released / total)
	};
}

export function heapLegend(memory: DiagnosticsMemory): DiagnosticRow[] {
	return [
		{ label: 'In Use', value: formatBytes(memory.heapInuse) },
		{ label: 'Idle', value: formatBytes(Math.max(0, memory.heapIdle - memory.heapReleased)) },
		{ label: 'Released', value: formatBytes(memory.heapReleased) }
	];
}

const connectionKindLabels: Record<string, string> = {
	project_logs: 'Project Logs',
	container_logs: 'Container Logs',
	container_stats: 'Container Stats',
	container_exec: 'Terminal',
	system_stats: 'System Stats',
	service_logs: 'Service Logs',
	diagnostics: 'Diagnostics'
};

export function connectionKindLabel(kind: string): string {
	return connectionKindLabels[kind] ?? kind;
}

export function connectionCounts(snapshot: DiagnosticsSnapshot): DiagnosticRow[] {
	const counts = snapshot.websocket.snapshot;
	return [
		{ label: 'Project Logs', value: formatCount(counts.projectLogsActive) },
		{ label: 'Container Logs', value: formatCount(counts.containerLogsActive) },
		{ label: 'Container Stats', value: formatCount(counts.containerStats) },
		{ label: 'Terminals', value: formatCount(counts.containerExec) },
		{ label: 'System Stats', value: formatCount(counts.systemStats) },
		{ label: 'Service Logs', value: formatCount(counts.serviceLogsActive) },
		{ label: 'Diagnostics', value: formatCount(counts.diagnosticsActive) }
	];
}

export function actorTypeCounts(type: ActorTypeInfo): DiagnosticRow[] {
	return [
		{
			label: 'Active',
			value:
				type.concurrencyLimit > 0
					? `${formatCount(type.activeActors)} / ${formatCount(type.concurrencyLimit)}`
					: formatCount(type.activeActors)
		},
		{ label: 'State', value: formatCount(type.storedStates) },
		{ label: 'Alarms', value: formatCount(type.pendingAlarms) },
		{ label: 'Pending', value: formatCount(type.pendingJobs) },
		{ label: 'Running', value: formatCount(type.leasedAlarms) },
		{ label: 'Completed', value: formatCount(type.completedJobs) },
		{ label: 'Failed', value: formatCount(type.deadJobs) }
	];
}

export const maxListedActorInstances = 50;

export function actorRunsSummary(runs: Record<string, number>): string {
	const entries = Object.entries(runs).filter(([, value]) => value > 0);
	if (entries.length === 0) return 'None';
	return entries.map(([status, value]) => `${formatCount(value)} ${status}`).join(' · ');
}

export type GoroutineGroupRow = { id: string; group: GoroutineGroup };

export function goroutineRows(profile: GoroutineProfile | undefined): GoroutineGroupRow[] {
	if (!profile) return [];
	const seen = new Map<string, number>();
	return profile.groups.map((group) => {
		const base = GoroutineProfile.groupKey(group);
		const occurrence = seen.get(base) ?? 0;
		seen.set(base, occurrence + 1);
		return { id: occurrence === 0 ? base : `${base}#${occurrence}`, group };
	});
}

export function filterGoroutineRows(
	rows: readonly GoroutineGroupRow[],
	query: string
): GoroutineGroupRow[] {
	const needle = query.trim().toLowerCase();
	if (needle === '') return [...rows];
	return rows.filter(
		({ group }) =>
			group.label.toLowerCase().includes(needle) ||
			group.frames.some(
				(frame) =>
					frame.function.toLowerCase().includes(needle) || frame.file.toLowerCase().includes(needle)
			)
	);
}

export type LogLevelFilter = 'all' | 'error' | 'warn' | 'info' | 'debug';

export const logLevelFilters: { value: LogLevelFilter; title: string }[] = [
	{ value: 'all', title: 'All Levels' },
	{ value: 'error', title: 'Error' },
	{ value: 'warn', title: 'Warning' },
	{ value: 'info', title: 'Info' },
	{ value: 'debug', title: 'Debug' }
];

export type LogTone = 'error' | 'warn' | 'debug' | 'info';

export function logTone(level: string): LogTone {
	const value = level.toLowerCase();
	if (value.startsWith('error')) return 'error';
	if (value.startsWith('warn')) return 'warn';
	if (value.startsWith('debug')) return 'debug';
	return 'info';
}

export type DiagnosticLogRow = { id: number; entry: ServerLogEntry; attrs: string };

export const maxDiagnosticLogRows = 1_000;

export function appendLogRows(
	rows: readonly DiagnosticLogRow[],
	incoming: readonly DiagnosticLogRow[],
	max = maxDiagnosticLogRows
): readonly DiagnosticLogRow[] {
	if (incoming.length === 0) return rows;
	const combined = [...rows, ...incoming];
	return combined.length > max ? combined.slice(combined.length - max) : combined;
}

export function filterLogRows(
	rows: readonly DiagnosticLogRow[],
	level: LogLevelFilter,
	query: string
): readonly DiagnosticLogRow[] {
	const needle = query.trim().toLowerCase();
	if (level === 'all' && needle === '') return rows;
	return rows.filter(({ entry }) => {
		if (level !== 'all' && !entry.level.toLowerCase().startsWith(level)) return false;
		return needle === '' || entry.message.toLowerCase().includes(needle);
	});
}

function formatAttrValue(value: unknown): string {
	if (value === undefined) return '';
	if (value === null) return 'null';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
		return String(value);
	return JSON.stringify(value) ?? '';
}

function appendAttrParts(prefix: string, value: unknown, parts: string[]) {
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		const entries = Object.entries(value as Record<string, unknown>);
		if (entries.length === 0) {
			parts.push(`${prefix}={}`);
			return;
		}
		for (const [key, child] of entries) appendAttrParts(`${prefix}.${key}`, child, parts);
		return;
	}
	parts.push(`${prefix}=${formatAttrValue(value)}`);
}

export function attrsText(attrs: Record<string, unknown> | undefined): string {
	if (!attrs) return '';
	const parts: string[] = [];
	for (const [key, value] of Object.entries(attrs)) appendAttrParts(key, value, parts);
	return parts.join('  ');
}

export function logTimeLabel(value: string): string {
	return formattedISO8601(value, 'omitted', 'standard');
}
