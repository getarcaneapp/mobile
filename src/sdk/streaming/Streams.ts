/**
 * Port of Streaming/Streams.swift: WebSocket-backed `LogStream` and
 * `StatsStream`. Each `for await` opens its own socket (single consumer);
 * breaking out of the loop closes it.
 */
import { ArcaneError, CancellationError, normalizedTransportError } from '../errors/ArcaneError';
import type { ArcaneTransport } from '../client/ArcaneTransport';
import { boolString, type QueryItem } from '../client/url';
import type { Decoder } from '../models/base/decoding';
import { decodeUTF8, parseArcaneJSON } from '../http/json';
import type { LogLine } from '../types/streaming/LogLine';
import { BufferingPolicy } from './AsyncQueue';
import { WebSocketChannel, type WebSocketFactory, type WebSocketMessage } from './WebSocketChannel';

/** @internal Shared stream options configured on the client. */
export interface WebSocketStreamConfig {
	factory?: WebSocketFactory;
	idleTimeoutMs?: number;
}

interface LogLineMessage {
	seq?: number;
	level?: string;
	message: string;
	service?: string;
	timestamp?: string;
}

function parseLogLineMessage(text: string): LogLineMessage | undefined {
	try {
		const raw = parseArcaneJSON(text);
		if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
		const o = raw as Record<string, unknown>;
		if (typeof o.message !== 'string') return undefined;
		const optString = (value: unknown) => (typeof value === 'string' ? value : undefined);
		if (o.seq !== undefined && typeof o.seq !== 'number') return undefined;
		if ([o.level, o.service, o.timestamp].some((v) => v !== undefined && typeof v !== 'string'))
			return undefined;
		return {
			seq: typeof o.seq === 'number' ? o.seq : undefined,
			level: optString(o.level),
			message: o.message,
			service: optString(o.service),
			timestamp: optString(o.timestamp)
		};
	} catch {
		return undefined;
	}
}

function toLogLine(json: LogLineMessage): LogLine {
	return {
		text: json.message,
		seq: json.seq,
		level: json.level,
		service: json.service,
		timestamp: json.timestamp
	};
}

/** Swift `LogStream` decode of one frame. Exported for tests. */
export function decodeLogFrame(message: WebSocketMessage): LogLine {
	if (message.kind === 'string') {
		const json = parseLogLineMessage(message.value);
		return json ? toLogLine(json) : { text: message.value };
	}
	const json = parseLogLineMessage(decodeUTF8(message.value));
	if (!json) throw ArcaneError.decoding('Log frame was not a valid LogLineMessage');
	return toLogLine(json);
}

async function* iterateChannel<Element>(
	open: () => Promise<WebSocketChannel<never, Element>>,
	policy: BufferingPolicy,
	signal: AbortSignal | undefined
): AsyncGenerator<Element, void, undefined> {
	if (signal?.aborted) throw new CancellationError();
	const channel = await open();
	try {
		for await (const value of channel.messages(policy)) yield value;
	} catch (error) {
		throw normalizedTransportError(error);
	} finally {
		channel.closeImmediately();
	}
}

export class LogStream implements AsyncIterable<LogLine> {
	private readonly transport: ArcaneTransport;
	private readonly path: string;
	private readonly query: QueryItem[];
	private readonly config: WebSocketStreamConfig;

	/** @internal */
	constructor(
		transport: ArcaneTransport,
		path: string,
		query: QueryItem[],
		config?: WebSocketStreamConfig
	) {
		this.transport = transport;
		this.path = path;
		this.query = [...query, { name: 'format', value: 'json' }];
		this.config = config ?? transport.webSocketConfig;
	}

	[Symbol.asyncIterator](): AsyncIterator<LogLine> {
		const signal = this.transport.defaultSignal;
		return iterateChannel(
			async () => {
				const request = await this.transport.websocketRequest(this.path, { query: this.query });
				return new WebSocketChannel<never, LogLine>({
					request,
					factory: this.config.factory,
					idleTimeoutMs: this.config.idleTimeoutMs,
					signal,
					encodeOutbound: () => {
						throw new Error('Log streams are receive-only');
					},
					decodeInbound: decodeLogFrame
				});
			},
			BufferingPolicy.unbounded,
			signal
		);
	}

	/** Swift `LogStream.query(follow:tail:since:timestamps:)`. */
	static query(
		follow: boolean,
		tail: string,
		since: string | undefined,
		timestamps: boolean
	): QueryItem[] {
		const query: QueryItem[] = [
			{ name: 'follow', value: boolString(follow) },
			{ name: 'tail', value: tail },
			{ name: 'timestamps', value: boolString(timestamps) }
		];
		if (since !== undefined) query.push({ name: 'since', value: since });
		return query;
	}
}

export class StatsStream<Element> implements AsyncIterable<Element> {
	private readonly transport: ArcaneTransport;
	private readonly path: string;
	private readonly query: QueryItem[];
	private readonly decoder: Decoder<Element> | undefined;
	private readonly config: WebSocketStreamConfig;

	/** @internal */
	constructor(
		transport: ArcaneTransport,
		path: string,
		query: QueryItem[] = [],
		decode?: Decoder<Element>,
		config?: WebSocketStreamConfig
	) {
		this.transport = transport;
		this.path = path;
		this.query = query;
		this.decoder = decode;
		this.config = config ?? transport.webSocketConfig;
	}

	[Symbol.asyncIterator](): AsyncIterator<Element> {
		const signal = this.transport.defaultSignal;
		const decoder = this.decoder;
		return iterateChannel(
			async () => {
				const request = await this.transport.websocketRequest(this.path, { query: this.query });
				return new WebSocketChannel<never, Element>({
					request,
					factory: this.config.factory,
					idleTimeoutMs: this.config.idleTimeoutMs,
					signal,
					encodeOutbound: () => {
						throw new Error('Stats streams are receive-only');
					},
					decodeInbound: (message) => {
						const text = message.kind === 'string' ? message.value : decodeUTF8(message.value);
						let raw: unknown;
						try {
							raw = parseArcaneJSON(text);
						} catch (error) {
							throw ArcaneError.decoding(String(error));
						}
						return decoder ? decoder(raw) : (raw as Element);
					}
				});
			},
			// Snapshot-style: never queue obsolete frames behind a slow consumer.
			BufferingPolicy.bufferingNewest(1),
			signal
		);
	}
}
