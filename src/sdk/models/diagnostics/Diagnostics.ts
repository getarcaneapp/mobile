import { D, type RawObject } from '../base/decoding';
import type { ISODateString } from '../base/date';
import type { WebSocketConnectionInfo } from '../system/WebSocketMetrics';

const count = (o: RawObject, key: string): number => D.optStringOrNumber(o, key) ?? 0;
const text = (o: RawObject, key: string): string => D.optStringFromAny(o, key) ?? '';
const optText = (o: RawObject, key: string): string | undefined => {
	const value = D.optStringFromAny(o, key);
	return value === undefined || value === '' ? undefined : value;
};
const list = <T>(o: RawObject, key: string, element: (raw: unknown) => T): T[] => {
	const value = o[key];
	if (!Array.isArray(value)) return [];
	const items: T[] = [];
	for (const item of value) {
		const decoded = D.attempt(() => element(item));
		if (decoded !== undefined) items.push(decoded);
	}
	return items;
};
const objectOrEmpty = (o: RawObject, key: string): RawObject =>
	D.isRecord(o[key]) ? (o[key] as RawObject) : {};

export interface DiagnosticsRuntime {
	goroutines: number;
	wsWorkerGoroutines: number;
	leakedGoroutines: number;
	leakScannedAt?: ISODateString;
	gomaxprocs: number;
	numCpu: number;
	goVersion: string;
	os: string;
	arch: string;
	numCgoCall: number;
	uptimeSeconds: number;
}

export interface DiagnosticsMemory {
	alloc: number;
	totalAlloc: number;
	sys: number;
	heapAlloc: number;
	heapSys: number;
	heapInuse: number;
	heapIdle: number;
	heapReleased: number;
	heapObjects: number;
	stackInuse: number;
	nextGc: number;
	numForcedGc: number;
	gcCpuFraction: number;
}

export interface DiagnosticsGC {
	lastGc?: ISODateString;
	numGc: number;
	pauseTotalNs: number;
	recentPausesNs: number[];
}

export interface DiagnosticsWebSocketCounts {
	projectLogsActive: number;
	containerLogsActive: number;
	containerStats: number;
	containerExec: number;
	systemStats: number;
	serviceLogsActive: number;
	diagnosticsActive: number;
}

export interface DiagnosticsWebSockets {
	snapshot: DiagnosticsWebSocketCounts;
	connections: WebSocketConnectionInfo[];
}

export interface DiagnosticsSnapshot {
	timestamp: ISODateString;
	runtime: DiagnosticsRuntime;
	memory: DiagnosticsMemory;
	gc: DiagnosticsGC;
	websocket: DiagnosticsWebSockets;
}

function decodeConnection(raw: unknown): WebSocketConnectionInfo {
	const o = D.object(raw, 'WebSocketConnectionInfo');
	return {
		id: D.string(o, 'id'),
		kind: text(o, 'kind'),
		envId: optText(o, 'envId'),
		resourceId: optText(o, 'resourceId'),
		clientIp: optText(o, 'clientIp'),
		userId: optText(o, 'userId'),
		userAgent: optText(o, 'userAgent'),
		startedAt: text(o, 'startedAt')
	};
}

export const DiagnosticsSnapshot = {
	decode(this: void, raw: unknown): DiagnosticsSnapshot {
		const o = D.object(raw, 'DiagnosticsSnapshot');
		const runtime = objectOrEmpty(o, 'runtime');
		const memory = objectOrEmpty(o, 'memory');
		const gc = objectOrEmpty(o, 'gc');
		const websocket = objectOrEmpty(o, 'websocket');
		const counts = objectOrEmpty(websocket, 'snapshot');
		const pauses = Array.isArray(gc.recentPausesNs) ? gc.recentPausesNs : [];
		return {
			timestamp: text(o, 'timestamp'),
			runtime: {
				goroutines: count(runtime, 'goroutines'),
				wsWorkerGoroutines: count(runtime, 'wsWorkerGoroutines'),
				leakedGoroutines: count(runtime, 'leakedGoroutines'),
				leakScannedAt: optText(runtime, 'leakScannedAt'),
				gomaxprocs: count(runtime, 'gomaxprocs'),
				numCpu: count(runtime, 'numCpu'),
				goVersion: text(runtime, 'goVersion'),
				os: text(runtime, 'os'),
				arch: text(runtime, 'arch'),
				numCgoCall: count(runtime, 'numCgoCall'),
				uptimeSeconds: count(runtime, 'uptimeSeconds')
			},
			memory: {
				alloc: count(memory, 'alloc'),
				totalAlloc: count(memory, 'totalAlloc'),
				sys: count(memory, 'sys'),
				heapAlloc: count(memory, 'heapAlloc'),
				heapSys: count(memory, 'heapSys'),
				heapInuse: count(memory, 'heapInuse'),
				heapIdle: count(memory, 'heapIdle'),
				heapReleased: count(memory, 'heapReleased'),
				heapObjects: count(memory, 'heapObjects'),
				stackInuse: count(memory, 'stackInuse'),
				nextGc: count(memory, 'nextGc'),
				numForcedGc: count(memory, 'numForcedGc'),
				gcCpuFraction: count(memory, 'gcCpuFraction')
			},
			gc: {
				lastGc: optText(gc, 'lastGc'),
				numGc: count(gc, 'numGc'),
				pauseTotalNs: count(gc, 'pauseTotalNs'),
				recentPausesNs: pauses.flatMap((value) => {
					const parsed = D.coerceNumber(value);
					return parsed === undefined ? [] : [parsed];
				})
			},
			websocket: {
				snapshot: {
					projectLogsActive: count(counts, 'projectLogsActive'),
					containerLogsActive: count(counts, 'containerLogsActive'),
					containerStats: count(counts, 'containerStats'),
					containerExec: count(counts, 'containerExec'),
					systemStats: count(counts, 'systemStats'),
					serviceLogsActive: count(counts, 'serviceLogsActive'),
					diagnosticsActive: count(counts, 'diagnosticsActive')
				},
				connections: list(websocket, 'connections', decodeConnection)
			}
		};
	}
} as const;

export type DiagnosticsMessage =
	| { type: 'snapshot'; snapshot: DiagnosticsSnapshot }
	| { type: 'other' };

export const DiagnosticsMessage = {
	decode(this: void, raw: unknown): DiagnosticsMessage {
		const o = D.object(raw, 'DiagnosticsMessage');
		if (o.type === 'snapshot' && D.isRecord(o.snapshot))
			return { type: 'snapshot', snapshot: DiagnosticsSnapshot.decode(o.snapshot) };
		if (o.type === undefined && D.isRecord(o.runtime))
			return { type: 'snapshot', snapshot: DiagnosticsSnapshot.decode(o) };
		return { type: 'other' };
	}
} as const;

export interface ActorHostInfo {
	hostId: string;
	address: string;
	lastHealthCheck?: ISODateString;
}

export interface ActorInstance {
	actorId: string;
	name?: string;
	hostId: string;
	activatedAt?: ISODateString;
}

export interface ActorJobFailure {
	jobId: string;
	actorId: string;
	name?: string;
	method: string;
	attempts: number;
	lastError?: string;
	failedAt?: ISODateString;
}

export interface ActorTypeInfo {
	actorType: string;
	concurrencyLimit: number;
	activeActors: number;
	storedStates: number;
	pendingAlarms: number;
	pendingJobs: number;
	leasedAlarms: number;
	completedJobs: number;
	deadJobs: number;
	nextAlarmAt?: ISODateString;
	instances: ActorInstance[];
	recentFailures: ActorJobFailure[];
}

export interface ActorDiagnostics {
	environmentId: string;
	environmentName: string;
	error?: string;
	ready: boolean;
	hosts: ActorHostInfo[];
	actorTypes: ActorTypeInfo[];
	runs: Record<string, number>;
	checkedAt?: ISODateString;
}

function decodeActorType(raw: unknown): ActorTypeInfo {
	const o = D.object(raw, 'ActorTypeInfo');
	return {
		actorType: D.string(o, 'actorType'),
		concurrencyLimit: count(o, 'concurrencyLimit'),
		activeActors: count(o, 'activeActors'),
		storedStates: count(o, 'storedStates'),
		pendingAlarms: count(o, 'pendingAlarms'),
		pendingJobs: count(o, 'pendingJobs'),
		leasedAlarms: count(o, 'leasedAlarms'),
		completedJobs: count(o, 'completedJobs'),
		deadJobs: count(o, 'deadJobs'),
		nextAlarmAt: optText(o, 'nextAlarmAt'),
		instances: list(o, 'instances', (item) => {
			const i = D.object(item, 'ActorInstance');
			return {
				actorId: D.string(i, 'actorId'),
				name: optText(i, 'name'),
				hostId: text(i, 'hostId'),
				activatedAt: optText(i, 'activatedAt')
			};
		}),
		recentFailures: list(o, 'recentFailures', (item) => {
			const f = D.object(item, 'ActorJobFailure');
			return {
				jobId: D.string(f, 'jobId'),
				actorId: text(f, 'actorId'),
				name: optText(f, 'name'),
				method: text(f, 'method'),
				attempts: count(f, 'attempts'),
				lastError: optText(f, 'lastError'),
				failedAt: optText(f, 'failedAt')
			};
		})
	};
}

function decodeRuns(o: RawObject): Record<string, number> {
	const raw = objectOrEmpty(o, 'runs');
	const runs: Record<string, number> = {};
	for (const [status, value] of Object.entries(raw)) {
		const parsed = D.coerceNumber(value);
		if (parsed !== undefined) runs[status] = parsed;
	}
	return runs;
}

export const ActorDiagnostics = {
	decode(this: void, raw: unknown): ActorDiagnostics {
		const o = D.object(raw, 'ActorDiagnostics');
		return {
			environmentId: text(o, 'environmentId'),
			environmentName: text(o, 'environmentName'),
			error: optText(o, 'error'),
			ready: o.ready === true,
			hosts: list(o, 'hosts', (item) => {
				const h = D.object(item, 'ActorHostInfo');
				return {
					hostId: text(h, 'hostId'),
					address: text(h, 'address'),
					lastHealthCheck: optText(h, 'lastHealthCheck')
				};
			}),
			actorTypes: list(o, 'actorTypes', decodeActorType),
			runs: decodeRuns(o),
			checkedAt: optText(o, 'checkedAt')
		};
	},

	decodeList(this: void, raw: unknown): ActorDiagnostics[] {
		if (!Array.isArray(raw)) return [];
		const items: ActorDiagnostics[] = [];
		for (const item of raw) {
			const decoded = D.attempt(() => ActorDiagnostics.decode(item));
			if (decoded !== undefined) items.push(decoded);
		}
		return items;
	}
} as const;

export interface GoroutineFrame {
	function: string;
	file: string;
	line: number;
}

export interface GoroutineGroup {
	count: number;
	label: string;
	frames: GoroutineFrame[];
}

export interface GoroutineProfile {
	total: number;
	groups: GoroutineGroup[];
	capturedAt?: ISODateString;
}

export const GoroutineProfile = {
	decode(this: void, raw: unknown): GoroutineProfile {
		const o = D.object(raw, 'GoroutineProfile');
		return {
			total: count(o, 'total'),
			groups: list(o, 'groups', (item) => {
				const g = D.object(item, 'GoroutineGroup');
				return {
					count: count(g, 'count'),
					label: text(g, 'label'),
					frames: list(g, 'frames', (frame) => {
						const f = D.object(frame, 'GoroutineFrame');
						return {
							function: text(f, 'function'),
							file: text(f, 'file'),
							line: count(f, 'line')
						};
					})
				};
			}),
			capturedAt: optText(o, 'capturedAt')
		};
	},

	groupKey(this: void, group: GoroutineGroup): string {
		return group.frames.map((f) => `${f.function}@${f.file}:${f.line}`).join('|') || group.label;
	}
} as const;

export interface ServerLogEntry {
	time: string;
	level: string;
	message: string;
	attrs?: Record<string, unknown>;
}

export const ServerLogEntry = {
	decode(this: void, raw: unknown): ServerLogEntry {
		const o = D.object(raw, 'ServerLogEntry');
		return {
			time: text(o, 'time'),
			level: text(o, 'level'),
			message: text(o, 'message'),
			attrs: D.isRecord(o.attrs) ? (o.attrs as Record<string, unknown>) : undefined
		};
	}
} as const;
