import { describe, expect, it } from 'vite-plus/test';

import { translateRouteForV3 } from '../client/v3Routes';
import { parseArcaneJSON } from '../http/json';
import {
	ActorDiagnostics,
	DiagnosticsMessage,
	DiagnosticsSnapshot,
	GoroutineProfile,
	ServerLogEntry
} from '../models/diagnostics/Diagnostics';
import { BrandImageSlot } from '../models/settings/BrandImage';

describe('DiagnosticsSnapshot.decode', () => {
	it('decodes a full snapshot', () => {
		const snapshot = DiagnosticsSnapshot.decode({
			timestamp: '2026-11-24T10:00:00Z',
			runtime: {
				goroutines: 42,
				wsWorkerGoroutines: 3,
				leakedGoroutines: 0,
				gomaxprocs: 8,
				numCpu: 8,
				goVersion: 'go1.26',
				os: 'linux',
				arch: 'amd64',
				numCgoCall: 10,
				uptimeSeconds: 3600
			},
			memory: { heapAlloc: 1024, heapSys: 4096, heapInuse: 2048, gcCpuFraction: 0.001 },
			gc: { numGc: 5, pauseTotalNs: 1500, recentPausesNs: [100, '200', 'x'] },
			websocket: {
				snapshot: { projectLogsActive: 1, diagnosticsActive: 2 },
				connections: [
					{ id: 'c1', kind: 'container_logs', startedAt: '2026-11-24T09:00:00Z' },
					{ kind: 'missing-id' }
				]
			}
		});
		expect(snapshot.runtime.goroutines).toBe(42);
		expect(snapshot.runtime.os).toBe('linux');
		expect(snapshot.memory.heapAlloc).toBe(1024);
		expect(snapshot.memory.totalAlloc).toBe(0);
		expect(snapshot.gc.recentPausesNs).toEqual([100, 200]);
		expect(snapshot.websocket.snapshot.diagnosticsActive).toBe(2);
		expect(snapshot.websocket.snapshot.containerExec).toBe(0);
		expect(snapshot.websocket.connections.map((c) => c.id)).toEqual(['c1']);
	});

	it('tolerates missing sections and null arrays', () => {
		const raw = parseArcaneJSON(
			JSON.stringify({ timestamp: 't', runtime: null, websocket: { connections: null } })
		);
		const snapshot = DiagnosticsSnapshot.decode(raw);
		expect(snapshot.runtime.goroutines).toBe(0);
		expect(snapshot.gc.recentPausesNs).toEqual([]);
		expect(snapshot.websocket.connections).toEqual([]);
	});
});

describe('DiagnosticsMessage.decode', () => {
	it('unwraps snapshot messages', () => {
		const message = DiagnosticsMessage.decode({
			type: 'snapshot',
			snapshot: { runtime: { goroutines: 7 } }
		});
		expect(message.type).toBe('snapshot');
		if (message.type === 'snapshot') expect(message.snapshot.runtime.goroutines).toBe(7);
	});

	it('accepts bare snapshots and ignores command results', () => {
		expect(DiagnosticsMessage.decode({ runtime: { goroutines: 1 } }).type).toBe('snapshot');
		expect(DiagnosticsMessage.decode({ type: 'result', id: '1', error: 'busy' }).type).toBe(
			'other'
		);
	});
});

describe('ActorDiagnostics.decodeList', () => {
	it('decodes environments and skips malformed entries', () => {
		const list = ActorDiagnostics.decodeList([
			{
				environmentId: '0',
				environmentName: 'Local',
				ready: true,
				hosts: [{ hostId: 'h', address: '127.0.0.1:1', lastHealthCheck: 't' }],
				actorTypes: [
					{
						actorType: 'jobs',
						activeActors: 2,
						deadJobs: 1,
						instances: [{ actorId: 'a1', hostId: 'h' }, { hostId: 'no-id' }],
						recentFailures: [{ jobId: 'j1', actorId: 'a1', method: 'run', attempts: 3 }]
					},
					{ concurrencyLimit: 2 }
				],
				runs: { completed: 4, failed: '1', bogus: 'x' }
			},
			'not-an-object'
		]);
		expect(list).toHaveLength(1);
		const [environment] = list;
		expect(environment?.ready).toBe(true);
		expect(environment?.actorTypes).toHaveLength(1);
		expect(environment?.actorTypes[0]?.instances.map((i) => i.actorId)).toEqual(['a1']);
		expect(environment?.actorTypes[0]?.recentFailures[0]?.attempts).toBe(3);
		expect(environment?.runs).toEqual({ completed: 4, failed: 1 });
	});

	it('returns an empty list for non-arrays', () => {
		expect(ActorDiagnostics.decodeList({})).toEqual([]);
	});
});

describe('GoroutineProfile', () => {
	it('decodes groups and builds stable keys from frames', () => {
		const profile = GoroutineProfile.decode({
			total: 3,
			groups: [
				{
					count: 2,
					label: 'main.worker',
					frames: [{ function: 'main.worker', file: 'main.go', line: 12 }]
				},
				{ count: 1, label: 'idle', frames: [] }
			]
		});
		expect(profile.total).toBe(3);
		expect(GoroutineProfile.groupKey(profile.groups[0]!)).toBe('main.worker@main.go:12');
		expect(GoroutineProfile.groupKey(profile.groups[1]!)).toBe('idle');
	});
});

describe('ServerLogEntry.decode', () => {
	it('keeps attrs objects only and tolerates missing fields', () => {
		expect(
			ServerLogEntry.decode({ time: 't', level: 'INFO', message: 'hi', attrs: { a: 1 } }).attrs
		).toEqual({ a: 1 });
		expect(ServerLogEntry.decode({ message: 'hi', attrs: 'x' }).attrs).toBeUndefined();
		expect(ServerLogEntry.decode({ level: 'INFO' }).message).toBe('');
	});
});

describe('diagnostics and branding routes', () => {
	it('moves goroutine diagnostics under agents on v3', () => {
		expect(
			translateRouteForV3({
				method: 'GET',
				path: 'environments/0/diagnostics/goroutines',
				query: []
			}).path
		).toBe('agents/0/diagnostics/goroutines');
	});

	it('leaves global diagnostics streams and brand image paths alone', () => {
		expect(translateRouteForV3({ method: 'GET', path: 'diagnostics/stream', query: [] }).path).toBe(
			'diagnostics/stream'
		);
		for (const slot of BrandImageSlot.knownCases) {
			const path = BrandImageSlot.uploadPath(slot);
			expect(translateRouteForV3({ method: 'PUT', path, query: [] })).toEqual({
				method: 'PUT',
				path,
				query: []
			});
		}
	});
});
