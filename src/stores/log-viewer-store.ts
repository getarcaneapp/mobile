import { formattedClockTime } from '@/core/date-formatting';
import { RemoteDataLimits, boundedText, saturatingAdd } from '@/core/networking/remote-data-limits';
import type { LogLine } from '@/sdk/types/streaming/LogLine';

export type LogViewerConnectionState =
	| { kind: 'idle' }
	| { kind: 'connecting' }
	| { kind: 'live' }
	| { kind: 'ended' }
	| { kind: 'failed'; message: string };

export type LogViewerSeverity = 'standard' | 'debug' | 'warning' | 'error';

export const LogViewerPreferences = {
	showTimestampsKey: 'arcane.logs.showTimestamps',
	wrapLinesKey: 'arcane.logs.wrapLines',
	showsTimestampsByDefault: false,
	wrapsLinesByDefault: true
} as const;

export const LogViewerFormatting = {
	severity(level: string | undefined): LogViewerSeverity {
		switch (level?.trim().toLowerCase()) {
			case 'error':
			case 'err':
			case 'crit':
			case 'critical':
			case 'fatal':
			case 'emerg':
			case 'alert':
				return 'error';
			case 'warn':
			case 'warning':
				return 'warning';
			case 'debug':
				return 'debug';
			default:
				return 'standard';
		}
	},

	levelLabel(level: string | undefined): string | undefined {
		const trimmed = level?.trim();
		if (!trimmed) return undefined;
		switch (LogViewerFormatting.severity(trimmed)) {
			case 'error':
				return 'ERROR';
			case 'warning':
				return 'WARN';
			case 'debug':
				return 'DEBUG';
			case 'standard':
				return trimmed.toUpperCase();
		}
	},

	parsedLevel(line: Pick<LogLine, 'level' | 'text'>): string | undefined {
		const level = line.level?.trim().toLowerCase();
		if (level !== 'stdout' && level !== 'stderr') return line.level;
		const head = line.text.slice(0, 160);
		const match =
			/\[(emerg|alert|crit|critical|fatal|error|err|warn|warning|debug)\]/i.exec(head) ??
			/\blevel=["']?(fatal|error|err|warn|warning|debug)\b/i.exec(head);
		return match?.[1] ?? line.level;
	},

	displayTimestamp(value: string): string {
		const formatted = formattedClockTime(value);
		if (formatted !== undefined) return formatted;
		const characters = Array.from(value);
		return characters.length > 8 ? characters.slice(-8).join('') : value;
	},

	exportText(line: LogLine, showTimestamps: boolean): string {
		const metadata: string[] = [];
		const timestamp = line.timestamp?.trim();
		if (showTimestamps && timestamp) metadata.push(`[${timestamp}]`);
		const service = line.service?.trim();
		if (service) metadata.push(`[${service}]`);
		const level = LogViewerFormatting.levelLabel(LogViewerFormatting.parsedLevel(line));
		if (level) metadata.push(`[${level}]`);
		metadata.push(line.text);
		return metadata.join(' ');
	},

	sanitizedFilename(value: string): string {
		const replaced = Array.from(value)
			.map((c) => (/^[\p{L}\p{N}_-]$/u.test(c) ? c : '-'))
			.join('');
		const collapsed = replaced
			.split('-')
			.filter((part) => part !== '')
			.join('-');
		return collapsed === '' ? 'logs' : collapsed;
	}
} as const;

export interface LogLinePresentation {
	severity: LogViewerSeverity;
	levelLabel?: string;
	displayTimestamp?: string;
}

export function logLinePresentation(line: LogLine): LogLinePresentation {
	const level = LogViewerFormatting.parsedLevel(line);
	return {
		severity: LogViewerFormatting.severity(level),
		levelLabel: LogViewerFormatting.levelLabel(level),
		displayTimestamp: line.timestamp
			? LogViewerFormatting.displayTimestamp(line.timestamp)
			: undefined
	};
}

export function logLineAccessibilityText(
	line: LogLine,
	presentation: LogLinePresentation,
	showTimestamps: boolean
) {
	const components: string[] = [];
	if (showTimestamps && presentation.displayTimestamp)
		components.push(presentation.displayTimestamp);
	const service = line.service?.trim();
	if (service) components.push(`Service ${service}`);
	if (presentation.levelLabel) components.push(presentation.levelLabel);
	components.push(line.text);
	return components.join(', ');
}

export interface LogViewerLine {
	id: number;
	line: LogLine;
	presentation: LogLinePresentation;
}

export interface LogViewerSnapshot {
	lines: LogViewerLine[];
	connectionState: LogViewerConnectionState;
	isFollowing: boolean;
	newLinesWhilePaused: number;
}

export type LogStreamFactory = (signal: AbortSignal) => AsyncIterable<LogLine> | undefined;

function isAbort(error: unknown) {
	return (
		error instanceof Error && (error.name === 'AbortError' || error.name === 'CancellationError')
	);
}

export class LogViewerStore {
	static readonly maximumRetainedLines = 5_000;
	static readonly flushIntervalMs = 100;

	private state: LogViewerSnapshot = {
		lines: [],
		connectionState: { kind: 'idle' },
		isFollowing: true,
		newLinesWhilePaused: 0
	};
	private listeners = new Set<() => void>();
	private controller: AbortController | undefined;
	private streamGeneration = 0;
	private nextLineID = 0;
	private pendingLines: LogLine[] = [];
	private flushTimer: ReturnType<typeof setTimeout> | undefined;

	private readonly makeLogStream: LogStreamFactory;

	constructor(makeLogStream: LogStreamFactory) {
		this.makeLogStream = makeLogStream;
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getSnapshot = () => this.state;

	private update(patch: Partial<LogViewerSnapshot>) {
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener();
	}

	get isRunning() {
		return this.controller !== undefined;
	}

	start() {
		if (this.controller) return;
		this.streamGeneration += 1;
		const generation = this.streamGeneration;
		const controller = new AbortController();
		this.controller = controller;
		this.update({ connectionState: { kind: 'connecting' } });
		void this.consumeStream(generation, controller);
	}

	stop() {
		this.streamGeneration += 1;
		this.controller?.abort();
		this.controller = undefined;
		this.flushPending();
		const kind = this.state.connectionState.kind;
		if (kind === 'connecting' || kind === 'live')
			this.update({ connectionState: { kind: 'idle' } });
	}

	retry() {
		this.streamGeneration += 1;
		this.controller?.abort();
		this.controller = undefined;
		this.start();
	}

	pauseFollowing() {
		if (!this.state.isFollowing) return;
		this.update({ isFollowing: false });
	}

	resumeFollowing() {
		if (this.state.isFollowing && this.state.newLinesWhilePaused === 0) return;
		this.update({ isFollowing: true, newLinesWhilePaused: 0 });
	}

	clear() {
		this.pendingLines = [];
		this.update({ lines: [], newLinesWhilePaused: 0 });
	}

	exportText(showTimestamps: boolean): string {
		return this.state.lines
			.map((entry) => LogViewerFormatting.exportText(entry.line, showTimestamps))
			.join('\n');
	}

	receive(newLines: LogLine[]) {
		if (newLines.length === 0) return;
		const entries: LogViewerLine[] = newLines.map((raw) => {
			const line: LogLine = {
				...raw,
				text: boundedText(raw.text, RemoteDataLimits.maximumStreamLineBytes),
				timestamp: raw.timestamp === undefined ? undefined : boundedText(raw.timestamp, 256),
				level: raw.level === undefined ? undefined : boundedText(raw.level, 64),
				service: raw.service === undefined ? undefined : boundedText(raw.service, 256)
			};
			const entry = { id: this.nextLineID, line, presentation: logLinePresentation(line) };
			this.nextLineID += 1;
			return entry;
		});
		let lines = [...this.state.lines, ...entries];
		if (lines.length > LogViewerStore.maximumRetainedLines) {
			lines = lines.slice(lines.length - LogViewerStore.maximumRetainedLines);
		}
		this.update({
			lines,
			newLinesWhilePaused: this.state.isFollowing
				? this.state.newLinesWhilePaused
				: saturatingAdd(
						this.state.newLinesWhilePaused,
						entries.length,
						LogViewerStore.maximumRetainedLines
					)
		});
	}

	private enqueue(line: LogLine) {
		this.pendingLines.push(line);
		if (this.flushTimer !== undefined) return;
		this.flushTimer = setTimeout(() => {
			this.flushTimer = undefined;
			this.flushPending();
		}, LogViewerStore.flushIntervalMs);
	}

	private flushPending() {
		if (this.flushTimer !== undefined) clearTimeout(this.flushTimer);
		this.flushTimer = undefined;
		if (this.pendingLines.length === 0) return;
		const batch = this.pendingLines;
		this.pendingLines = [];
		this.receive(batch);
	}

	private async consumeStream(generation: number, controller: AbortController) {
		const isCurrent = () => generation === this.streamGeneration && !controller.signal.aborted;
		try {
			const stream = this.makeLogStream(controller.signal);
			if (!stream) {
				if (generation === this.streamGeneration) {
					this.update({
						connectionState: { kind: 'failed', message: 'Log stream is unavailable.' }
					});
				}
				return;
			}
			await Promise.resolve();
			if (!isCurrent()) return;
			this.update({ connectionState: { kind: 'live' } });
			try {
				for await (const line of stream) {
					if (!isCurrent()) return;
					this.enqueue(line);
				}
				if (isCurrent()) {
					this.flushPending();
					this.update({ connectionState: { kind: 'ended' } });
				}
			} catch (error) {
				if (generation !== this.streamGeneration) return;
				this.flushPending();
				if (controller.signal.aborted || isAbort(error))
					this.update({ connectionState: { kind: 'idle' } });
				else
					this.update({
						connectionState: {
							kind: 'failed',
							message: error instanceof Error ? error.message : String(error)
						}
					});
			}
		} finally {
			if (generation === this.streamGeneration && this.controller === controller)
				this.controller = undefined;
		}
	}
}
