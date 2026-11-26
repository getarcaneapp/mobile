import { describe, expect, it } from 'vite-plus/test';

import {
	DiagnosticsSnapshot,
	GoroutineProfile,
	type ServerLogEntry
} from '@/sdk/models/diagnostics/Diagnostics';

import {
	actorRunsSummary,
	actorTypeCounts,
	appendLogRows,
	attrsText,
	connectionKindLabel,
	filterGoroutineRows,
	filterLogRows,
	formatPauseNs,
	formatUptime,
	gcRows,
	goroutineRows,
	heapSegments,
	leakedGoroutinesValue,
	logTone,
	type DiagnosticLogRow
} from '../diagnostics-model';

const log = (id: number, level: string, message: string): DiagnosticLogRow => ({
	id,
	entry: { time: '', level, message } as ServerLogEntry,
	attrs: ''
});

describe('diagnostics formatting', () => {
	it('formats uptime like the web UI', () => {
		expect(formatUptime(42)).toBe('42s');
		expect(formatUptime(125)).toBe('2m 5s');
		expect(formatUptime(3_700)).toBe('1h 1m');
		expect(formatUptime(90_000)).toBe('1d 1h');
	});

	it('formats GC pauses in µs or ms', () => {
		expect(formatPauseNs(500_000)).toBe('500µs');
		expect(formatPauseNs(2_500_000)).toBe('2.50ms');
	});

	it('reports leak scans', () => {
		const snapshot = DiagnosticsSnapshot.decode({ runtime: { leakedGoroutines: 0 } });
		expect(leakedGoroutinesValue(snapshot)).toBe('Not scanned');
		const scanned = DiagnosticsSnapshot.decode({
			runtime: { leakedGoroutines: 0, leakScannedAt: '2026-11-24T00:00:00Z' }
		});
		expect(leakedGoroutinesValue(scanned)).toBe('0');
	});

	it('adds the longest recent pause when present', () => {
		const snapshot = DiagnosticsSnapshot.decode({ gc: { recentPausesNs: [10_000, 3_000_000] } });
		expect(gcRows(snapshot).at(-1)).toEqual({ label: 'Longest Recent Pause', value: '3.00ms' });
		expect(gcRows(DiagnosticsSnapshot.decode({})).map((row) => row.label)).not.toContain(
			'Longest Recent Pause'
		);
	});

	it('splits the heap into proportional segments', () => {
		const memory = DiagnosticsSnapshot.decode({
			memory: { heapSys: 100, heapInuse: 50, heapIdle: 40, heapReleased: 10 }
		}).memory;
		expect(heapSegments(memory)).toEqual({ inUse: 0.5, idle: 0.3, released: 0.1 });
		expect(heapSegments({ ...memory, heapSys: 0 })).toBeUndefined();
	});

	it('labels connection kinds and actor counts', () => {
		expect(connectionKindLabel('container_exec')).toBe('Terminal');
		expect(connectionKindLabel('custom')).toBe('custom');
		const [active] = actorTypeCounts({
			actorType: 't',
			concurrencyLimit: 4,
			activeActors: 2,
			storedStates: 0,
			pendingAlarms: 0,
			pendingJobs: 0,
			leasedAlarms: 0,
			completedJobs: 0,
			deadJobs: 0,
			instances: [],
			recentFailures: []
		});
		expect(active).toEqual({ label: 'Active', value: '2 / 4' });
		expect(actorRunsSummary({ completed: 3, failed: 0 })).toBe('3 completed');
		expect(actorRunsSummary({})).toBe('None');
	});
});

describe('goroutine rows', () => {
	const profile = GoroutineProfile.decode({
		total: 4,
		groups: [
			{
				count: 2,
				label: 'http.serve',
				frames: [{ function: 'net/http.serve', file: 'server.go', line: 1 }]
			},
			{ count: 1, label: 'dup', frames: [] },
			{ count: 1, label: 'dup', frames: [] }
		]
	});

	it('keeps ids unique when stacks repeat', () => {
		expect(goroutineRows(profile).map((row) => row.id)).toEqual([
			'net/http.serve@server.go:1',
			'dup',
			'dup#1'
		]);
		expect(goroutineRows(undefined)).toEqual([]);
	});

	it('filters by label, function or file', () => {
		const rows = goroutineRows(profile);
		expect(filterGoroutineRows(rows, 'SERVER.GO')).toHaveLength(1);
		expect(filterGoroutineRows(rows, '  ')).toHaveLength(3);
	});
});

describe('log rows', () => {
	it('caps the buffer to the newest rows', () => {
		const rows = appendLogRows(
			[log(1, 'INFO', 'a'), log(2, 'INFO', 'b')],
			[log(3, 'INFO', 'c')],
			2
		);
		expect(rows.map((row) => row.id)).toEqual([2, 3]);
		const unchanged = [log(1, 'INFO', 'a')];
		expect(appendLogRows(unchanged, [])).toBe(unchanged);
	});

	it('filters by level prefix and message text', () => {
		const rows = [log(1, 'ERROR', 'disk full'), log(2, 'WARN', 'slow'), log(3, 'INFO', 'Disk ok')];
		expect(filterLogRows(rows, 'error', '').map((row) => row.id)).toEqual([1]);
		expect(filterLogRows(rows, 'all', 'disk').map((row) => row.id)).toEqual([1, 3]);
		expect(filterLogRows(rows, 'all', '')).toBe(rows);
	});

	it('maps levels to tones', () => {
		expect(logTone('WARNING')).toBe('warn');
		expect(logTone('debug')).toBe('debug');
		expect(logTone('INFO')).toBe('info');
	});

	it('flattens nested attrs', () => {
		expect(attrsText({ env: 'prod', http: { status: 500, empty: {} }, ok: true, nil: null })).toBe(
			'env=prod  http.status=500  http.empty={}  ok=true  nil=null'
		);
		expect(attrsText(undefined)).toBe('');
	});
});
