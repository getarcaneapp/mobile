import assert from 'node:assert/strict';
import { describe, it, test } from 'vite-plus/test';

import { formatDate, formattedClockTime } from '@/core/date-formatting';
import { parseEnvironmentVariable } from '@/core/environment-secret-detector';
import { localizedStandardCompare } from '@/core/list-sort-order';
import { arcaneTimestampMs, parseArcaneDate } from '@/sdk/models/base/date';
import {
	TerminalFrameDecoder,
	TerminalOutputBuffer,
	TerminalOutputFollowBehavior,
	TerminalOutputProcessor
} from '@/core/terminal-output-processor';
import {
	createRequest,
	draftFromConfig,
	draftsEqual,
	editRequest,
	emptyDraft,
	newPortDraft
} from '@/features/containers/container-configuration-draft';
import {
	activeFilterCount,
	bulkInlineActions,
	bulkPrimaryAction,
	computeContainerSections,
	containerDisplayName,
	containerHealth,
	containerStatusText,
	imageUpdateState,
	processRow,
	themedIconUrl,
	type ContainerListItem
} from '@/features/containers/container-model';
import { chartSeries, parseContainerStatsFrame } from '@/features/containers/container-stats-frame';
import { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import { LogViewerFormatting, LogViewerStore } from '@/stores/log-viewer-store';

const item = (
	id: string,
	state: string,
	extra: Partial<ContainerSummary> = {}
): ContainerListItem => ({
	id,
	environmentID: '0',
	value: ContainerSummary.make({
		id,
		names: [`/${id}`],
		image: `${id}:latest`,
		imageId: '',
		state,
		status: '',
		...extra
	})
});

const filters = {
	search: '',
	stateFilter: 'All' as const,
	updateFilter: 'all' as const,
	showHidden: false,
	sort: 'nameAscending' as const
};

describe('container model', () => {
	test('display name trims slashes and falls back to the short ID', () => {
		assert.equal(containerDisplayName({ id: 'abcdef1234567890', names: ['/web'] }), 'web');
		assert.equal(containerDisplayName({ id: 'abcdef1234567890', names: ['/'] }), 'abcdef123456');
		assert.equal(containerDisplayName({ id: 'abcdef1234567890', names: [] }), 'abcdef123456');
	});

	test('health parsing and status text', () => {
		assert.equal(containerHealth('Up 3 hours (healthy)')?.label, 'Healthy');
		assert.equal(containerHealth('Up 3 hours (unhealthy)')?.label, 'Unhealthy');
		assert.equal(containerHealth('Up 1 second (health: starting)')?.color, 'yellow');
		assert.equal(containerHealth('Exited (0) 2 hours ago'), undefined);
		assert.equal(containerStatusText('Up 3 hours (Healthy)'), 'Up 3 hours');
		assert.equal(containerStatusText('Exited (0) 2 hours ago'), 'Exited (0) 2 hours ago');
	});

	test('themed icon prefers dark artwork in light mode', () => {
		const value = { iconLightUrl: 'https://x/light.png', iconDarkUrl: 'https://x/dark.png' };
		assert.equal(themedIconUrl(value, false), 'https://x/dark.png');
		assert.equal(themedIconUrl(value, true), 'https://x/light.png');
		assert.equal(themedIconUrl({ labels: { 'arcane.icon': 'ftp://nope' } }, true), undefined);
		assert.equal(
			themedIconUrl({ labels: { 'arcane.icon': ' /icons/a.png ' } }, true),
			'/icons/a.png'
		);
	});

	test('update state from info', () => {
		assert.equal(imageUpdateState(undefined).kind, 'unknown');
		assert.equal(imageUpdateState({ hasUpdate: true, error: '' } as never).kind, 'hasUpdate');
		assert.deepEqual(imageUpdateState({ hasUpdate: false, error: 'boom' } as never), {
			kind: 'error',
			message: 'boom'
		});
		assert.equal(
			imageUpdateState({ hasUpdate: false, error: '', checkTime: '2024-01-01T00:00:00Z' } as never)
				.kind,
			'upToDate'
		);
	});

	test('sections partition pinned, running and stopped', () => {
		const list = [
			item('b', 'running'),
			item('a', 'exited'),
			item('c', 'running'),
			item('hidden', 'running', { hidden: true })
		];
		const sections = computeContainerSections(list, filters, new Set(['c']), () => undefined);
		assert.deepEqual(
			sections.map((s) => s.items.map((i) => i.id)),
			[['c'], ['b'], ['a']]
		);
		const withHidden = computeContainerSections(
			list,
			{ ...filters, showHidden: true },
			new Set(),
			() => undefined
		);
		assert.deepEqual(
			withHidden[1]!.items.map((i) => i.id),
			['b', 'c', 'hidden']
		);
	});

	test('search, state filter, and natural name sort', () => {
		const list = [item('web10', 'running'), item('web2', 'running'), item('db', 'exited')];
		const sections = computeContainerSections(
			list,
			{ ...filters, search: 'WEB' },
			new Set(),
			() => undefined
		);
		assert.deepEqual(
			sections[1]!.items.map((i) => i.id),
			['web2', 'web10']
		);
		const stopped = computeContainerSections(
			list,
			{ ...filters, stateFilter: 'Stopped' },
			new Set(),
			() => undefined
		);
		assert.deepEqual(
			stopped.flatMap((s) => s.items.map((i) => i.id)),
			['db']
		);
		const descending = computeContainerSections(
			list,
			{ ...filters, sort: 'nameDescending' },
			new Set(),
			() => undefined
		);
		assert.deepEqual(
			descending[1]!.items.map((i) => i.id),
			['web10', 'web2']
		);
	});

	test('resource sort puts heaviest first and unsampled last', () => {
		const list = [
			item('a', 'running'),
			item('b', 'running'),
			item('c', 'running'),
			item('d', 'running')
		];
		const samples: Record<string, number> = { a: 5, b: 50, d: 50 };
		const sample = (i: ContainerListItem) =>
			samples[i.id] === undefined
				? undefined
				: { cpuPercent: samples[i.id]!, memoryUsageBytes: 0, memoryLimitBytes: 0 };
		const sections = computeContainerSections(
			list,
			{ ...filters, sort: 'cpuUsage' },
			new Set(),
			sample
		);
		assert.deepEqual(
			sections[1]!.items.map((i) => i.id),
			['b', 'd', 'a', 'c']
		);
	});

	test('active filter count and bulk actions', () => {
		assert.equal(
			activeFilterCount({
				stateFilter: 'Running',
				updateFilter: 'hasUpdates',
				showHidden: true,
				labelFilter: ' a=b ',
				environmentFilter: '1'
			}),
			5
		);
		assert.equal(
			activeFilterCount({
				stateFilter: 'All',
				updateFilter: 'all',
				showHidden: false,
				labelFilter: '  '
			}),
			0
		);
		const running = item('r', 'running');
		const stopped = item('s', 'exited');
		assert.equal(bulkPrimaryAction([stopped]), 'start');
		assert.equal(bulkPrimaryAction([running]), 'stop');
		assert.equal(bulkPrimaryAction([running, stopped]), 'restart');
		assert.deepEqual(bulkInlineActions([running, stopped]), ['start', 'stop']);
		assert.deepEqual(bulkInlineActions([running]), ['restart']);
	});

	test('process rows pull out pid, user and command', () => {
		const row = processRow(
			0,
			['UID', 'PID', 'PPID', 'C', 'CMD'],
			['root', '1', '0', '?', 'nginx -g daemon off;']
		);
		assert.equal(row.user, 'root');
		assert.equal(row.pid, '1');
		assert.equal(row.command, 'nginx -g daemon off;');
		assert.deepEqual(row.extras, [{ title: 'PPID', value: '0' }]);
	});
});

describe('container stats frame', () => {
	const raw = (cpu: number, sys: number, rx: number) => ({
		cpu_stats: { cpu_usage: { total_usage: cpu }, system_cpu_usage: sys, online_cpus: 2 },
		precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
		memory_stats: { usage: 300, stats: { inactive_file: 100 }, limit: 1000 },
		networks: { eth0: { rx_bytes: rx, tx_bytes: 0 } },
		blkio_stats: {
			io_service_bytes_recursive: [
				{ op: 'Read', value: 10 },
				{ op: 'write', value: 4 }
			]
		}
	});

	test('computes CPU, memory, and rates', () => {
		const first = parseContainerStatsFrame(raw(50, 100, 1000), undefined, 1_000)!;
		assert.equal(first.cpuPercent, 100);
		assert.equal(first.memoryUsed, 200);
		assert.equal(first.memoryPercent, 20);
		assert.equal(first.netRxPerSec, 0);
		assert.equal(first.blockReadBytes, 10);
		assert.equal(first.blockWriteBytes, 4);
		const second = parseContainerStatsFrame(raw(50, 100, 3000), first, 3_000)!;
		assert.equal(second.netRxPerSec, 1000);
		assert.deepEqual(chartSeries([first, second]).networkReceive, [0, 1000]);
		assert.equal(parseContainerStatsFrame('nope', undefined), undefined);
	});
});

describe('container configuration draft', () => {
	const config = {
		id: 'abc',
		name: 'web',
		image: 'nginx:latest',
		running: true,
		command: ['nginx', '-g', 'daemon off;'],
		environment: ['A=1'],
		labels: { b: '2', a: '1' },
		hostConfig: {
			portBindings: { '80/tcp': [{ hostIp: '', hostPort: '8080' }] },
			restartPolicy: { name: 'always', maximumRetryCount: 0 },
			memory: 0
		},
		networks: { bridge: { aliases: ['web'] } }
	};

	test('round-trips a loaded config without changes', () => {
		const draft = draftFromConfig(config);
		assert.equal(draft.labels, 'a=1\nb=2');
		assert.equal(draft.ports[0]?.hostPort, '8080');
		assert.equal(draft.restartPolicy, 'always');
		assert.deepEqual(editRequest(draft, draft), {});
		assert.equal(draftsEqual(draft, { ...draft }), true);
	});

	test('edit request carries only changed fields', () => {
		const original = draftFromConfig(config);
		const edited = {
			...original,
			image: 'nginx:1.27',
			memory: '1024',
			ports: [...original.ports, newPortDraft({ port: '443/tcp' })]
		};
		const edit = editRequest(edited, original);
		assert.equal(edit.image, 'nginx:1.27');
		assert.equal(edit.name, undefined);
		assert.equal(edit.hostConfig?.memory, 1024);
		assert.deepEqual(Object.keys(edit.hostConfig?.portBindings ?? {}).sort(), [
			'443/tcp',
			'80/tcp'
		]);
		assert.equal(edit.hostConfig?.privileged, undefined);
	});

	test('validation errors', () => {
		assert.throws(
			() => createRequest({ ...emptyDraft(), name: '-bad', image: 'x' }),
			/container name/
		);
		assert.throws(
			() => createRequest({ ...emptyDraft(), name: 'ok', image: ' ' }),
			/image reference/
		);
		assert.throws(
			() =>
				createRequest({
					...emptyDraft(),
					name: 'ok',
					image: 'x',
					ports: [newPortDraft({ port: '80' })]
				}),
			/80\/tcp/
		);
		assert.throws(
			() =>
				createRequest({
					...emptyDraft(),
					name: 'ok',
					image: 'x',
					ports: [newPortDraft({ hostPort: '70000' })]
				}),
			/Host ports/
		);
		assert.throws(
			() => createRequest({ ...emptyDraft(), name: 'ok', image: 'x', memory: '-1' }),
			/Memory must be/
		);
		assert.equal(
			createRequest({ ...emptyDraft(), name: 'ok', image: 'x', memorySwap: '-1' }).hostConfig
				?.memorySwap,
			-1
		);
		assert.throws(
			() => createRequest({ ...emptyDraft(), name: 'ok', image: 'x', labels: '=x' }),
			/name=value/
		);
		assert.throws(
			() =>
				createRequest({
					...emptyDraft(),
					name: 'ok',
					image: 'x',
					healthMode: 'custom',
					healthCommand: 'curl'
				}),
			/CMD or CMD-SHELL/
		);
	});

	test('health modes', () => {
		const disabled = createRequest({
			...emptyDraft(),
			name: 'ok',
			image: 'x',
			healthMode: 'disabled'
		});
		assert.deepEqual(disabled.healthcheck, { test: ['NONE'] });
		const original = draftFromConfig({ ...config, healthcheck: { test: ['NONE'] } });
		assert.equal(original.healthMode, 'disabled');
		const edit = editRequest({ ...original, healthMode: 'inherit' }, original);
		assert.equal(edit.clearHealthcheck, true);
		assert.equal(edit.healthcheck, undefined);
	});
});

describe('terminal output', () => {
	const bytes = (text: string) => new TextEncoder().encode(text);

	test('strips ANSI sequences and counts DSR requests', () => {
		const decoder = new TerminalFrameDecoder();
		const decoded = decoder.decode(
			bytes('\u001b[1;32mok\u001b[0m\u001b[6n\u001b]0;title\u0007!\u0007')
		);
		assert.equal(decoded.text, 'ok!');
		assert.equal(decoded.dsrReplyCount, 1);
	});

	test('decodes UTF-8 split across frames and replaces invalid bytes', () => {
		const decoder = new TerminalFrameDecoder();
		const euro = bytes('€');
		assert.equal(decoder.decode(euro.slice(0, 1)).text, '');
		assert.equal(decoder.decode(euro.slice(1)).text, '€');
		assert.equal(decoder.decode(new Uint8Array([0xff, 0x41])).text, '�A');
		assert.equal(decoder.decode(new Uint8Array([0xe2, 0x41])).text, '�A');
		decoder.decode(new Uint8Array([0xe2]));
		assert.equal(decoder.finish().text, '�');
	});

	test('buffer splits lines, treats CRLF across chunks as one newline, and trims', () => {
		const buffer = new TerminalOutputBuffer(3, 100);
		buffer.append('a\r');
		buffer.append('\nb\nc\rd');
		assert.deepEqual(
			buffer.lineSnapshot().map((l) => l.text),
			['b', 'c', 'd']
		);
		const small = new TerminalOutputBuffer(10, 5);
		small.append('abc\ndefgh');
		assert.deepEqual(
			small.lineSnapshot().map((l) => l.text),
			['defgh']
		);
		small.append('ijk');
		assert.deepEqual(
			small.lineSnapshot().map((l) => l.text),
			['ghijk']
		);
	});

	test('processor and follow behavior', () => {
		const processor = new TerminalOutputProcessor();
		assert.equal(processor.append(bytes('$ ls\r\nfile\u001b[6n')), 1);
		assert.equal(processor.snapshot().fullText, '$ ls\nfile');
		processor.clear();
		assert.equal(processor.snapshot().fullText, '');
		const follow = new TerminalOutputFollowBehavior();
		follow.observe(false, false);
		assert.equal(follow.isFollowing, true);
		follow.observe(false, true);
		assert.equal(follow.isFollowing, false);
		follow.observe(true, false);
		assert.equal(follow.isFollowing, true);
	});
});

describe('log viewer', () => {
	test('formatting', () => {
		assert.equal(LogViewerFormatting.severity(' ERR '), 'error');
		assert.equal(LogViewerFormatting.levelLabel('warning'), 'WARN');
		assert.equal(LogViewerFormatting.levelLabel('info'), 'INFO');
		assert.equal(LogViewerFormatting.levelLabel('  '), undefined);
		assert.equal(LogViewerFormatting.displayTimestamp('not a date value'), 'te value');
		assert.equal(LogViewerFormatting.displayTimestamp('short'), 'short');
		assert.equal(
			LogViewerFormatting.exportText(
				{ text: 'hi', timestamp: 't', service: 'web', level: 'error' },
				true
			),
			'[t] [web] [ERROR] hi'
		);
		assert.equal(LogViewerFormatting.exportText({ text: 'hi', timestamp: 't' }, false), 'hi');
		assert.equal(LogViewerFormatting.sanitizedFilename('my app/logs!!'), 'my-app-logs');
		assert.equal(LogViewerFormatting.sanitizedFilename('///'), 'logs');
	});

	test('store retains the newest lines and counts lines while paused', () => {
		const store = new LogViewerStore(() => undefined);
		store.receive(
			Array.from({ length: LogViewerStore.maximumRetainedLines + 10 }, (_, i) => ({
				text: `line ${i}`
			}))
		);
		const snapshot = store.getSnapshot();
		assert.equal(snapshot.lines.length, LogViewerStore.maximumRetainedLines);
		assert.equal(snapshot.lines[0]?.line.text, 'line 10');
		store.pauseFollowing();
		store.receive([{ text: 'a' }, { text: 'b' }]);
		assert.equal(store.getSnapshot().newLinesWhilePaused, 2);
		store.resumeFollowing();
		assert.equal(store.getSnapshot().newLinesWhilePaused, 0);
		assert.equal(store.getSnapshot().isFollowing, true);
		store.clear();
		assert.equal(store.getSnapshot().lines.length, 0);
	});

	test('stream lifecycle reports live then ended, batching lines', async () => {
		const store = new LogViewerStore(() =>
			(async function* () {
				yield { text: 'one' };
				yield { text: 'two' };
			})()
		);
		store.start();
		assert.equal(store.getSnapshot().connectionState.kind, 'connecting');
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(store.getSnapshot().connectionState.kind, 'ended');
		assert.deepEqual(
			store.getSnapshot().lines.map((l) => l.line.text),
			['one', 'two']
		);
		assert.equal(store.exportText(false), 'one\ntwo');
	});

	test('unavailable stream fails', async () => {
		const store = new LogViewerStore(() => undefined);
		store.start();
		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.deepEqual(store.getSnapshot().connectionState, {
			kind: 'failed',
			message: 'Log stream is unavailable.'
		});
	});
});

describe('environment variables', () => {
	test('secret detection', () => {
		assert.equal(parseEnvironmentVariable('DB_PASSWORD=hunter2').isPotentialSecret, true);
		assert.equal(parseEnvironmentVariable('API_KEY=abc').isPotentialSecret, true);
		assert.equal(parseEnvironmentVariable('PUBLIC_KEY=abc').isPotentialSecret, false);
		assert.equal(parseEnvironmentVariable('TOKEN_URL=https://x').isPotentialSecret, false);
		assert.equal(parseEnvironmentVariable('PATH=/usr/bin').isPotentialSecret, false);
		assert.equal(parseEnvironmentVariable('DSN=postgres://u:pw@db/x').isPotentialSecret, true);
		assert.equal(parseEnvironmentVariable('X=ghp_abcdef').isPotentialSecret, true);
		assert.equal(parseEnvironmentVariable('EMPTY_SECRET=""').isPotentialSecret, false);
		assert.deepEqual(parseEnvironmentVariable('NOVALUE'), {
			rawValue: 'NOVALUE',
			name: 'NOVALUE',
			isPotentialSecret: false
		});
	});
});

describe('cached formatters', () => {
	it('sorts like localeCompare with numeric base sensitivity', () => {
		const names = ['web-10', 'Web-2', 'api', 'web-1', 'Älpha', 'alpha', 'db-002', 'db-1'];
		const expected = [...names].sort((a, b) =>
			a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
		);
		assert.deepEqual([...names].sort(localizedStandardCompare), expected);
	});

	it('formats dates like toLocaleString with the same options', () => {
		const date = new Date(2026, 9, 17, 14, 5, 9);
		assert.equal(
			formatDate(date, 'abbreviated', 'shortened'),
			date.toLocaleString(undefined, {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit'
			})
		);
		assert.equal(
			formatDate(date, 'numeric', 'omitted'),
			date.toLocaleString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })
		);
		assert.equal(formatDate(date, 'omitted', 'omitted'), date.toLocaleString(undefined, {}));
		assert.equal(
			formattedClockTime('2026-10-17T14:05:09Z'),
			new Date('2026-10-17T14:05:09Z').toLocaleTimeString(undefined, {
				hour: 'numeric',
				minute: '2-digit',
				second: '2-digit'
			})
		);
	});

	it('caches parsed timestamps without changing results', () => {
		const value = '2026-10-17T14:05:09.123+02:00';
		assert.equal(arcaneTimestampMs(value), parseArcaneDate(value)?.getTime());
		assert.equal(arcaneTimestampMs(value), parseArcaneDate(value)?.getTime());
		assert.equal(arcaneTimestampMs('not a date'), undefined);
		assert.equal(arcaneTimestampMs('not a date'), undefined);
		assert.equal(arcaneTimestampMs(undefined), undefined);
	});
});
