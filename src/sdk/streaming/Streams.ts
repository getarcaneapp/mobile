import { ArcaneError, CancellationError, normalizedTransportError } from '../errors/ArcaneError';
import type { ArcaneTransport } from '../client/ArcaneTransport';
import { boolString, type QueryItem } from '../client/url';
import type { Decoder } from '../models/base/decoding';
import { decodeUTF8, parseArcaneJSON } from '../http/json';
import type { LogLine } from '../types/streaming/LogLine';
import { BufferingPolicy } from './AsyncQueue';
import { WebSocketChannel, type WebSocketFactory, type WebSocketMessage } from './WebSocketChannel';

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

function logLineMessage(raw: unknown): LogLineMessage | undefined {
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
}

function parseLogLineMessages(text: string): LogLineMessage[] | undefined {
	let raw: unknown;
	try {
		raw = parseArcaneJSON(text);
	} catch {
		return undefined;
	}
	if (!Array.isArray(raw)) {
		const single = logLineMessage(raw);
		return single ? [single] : undefined;
	}
	const messages: LogLineMessage[] = [];
	for (const item of raw) {
		const message = logLineMessage(item);
		if (!message) return undefined;
		messages.push(message);
	}
	return messages;
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

export function decodeLogFrame(message: WebSocketMessage): LogLine[] {
	if (message.kind === 'string') {
		const json = parseLogLineMessages(message.value);
		return json ? json.map(toLogLine) : [{ text: message.value }];
	}
	const json = parseLogLineMessages(decodeUTF8(message.value));
	if (!json) throw ArcaneError.decoding('Log frame was not a valid LogLineMessage');
	return json.map(toLogLine);
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

async function* flatten<Element>(
	batches: AsyncIterable<Element[]>
): AsyncGenerator<Element, void, undefined> {
	for await (const batch of batches) yield* batch;
}

export class LogStream implements AsyncIterable<LogLine> {
	private readonly transport: ArcaneTransport;
	private readonly path: string;
	private readonly query: QueryItem[];
	private readonly config: WebSocketStreamConfig;

	constructor(
		transport: ArcaneTransport,
		path: string,
		query: QueryItem[],
		config?: WebSocketStreamConfig
	) {
		this.transport = transport;
		this.path = path;
		this.query = [...query, { name: 'format', value: 'json' }, { name: 'batched', value: 'true' }];
		this.config = config ?? transport.webSocketConfig;
	}

	[Symbol.asyncIterator](): AsyncIterator<LogLine> {
		return flatten(this.batches());
	}

	private batches(): AsyncGenerator<LogLine[], void, undefined> {
		const signal = this.transport.defaultSignal;
		return iterateChannel(
			async () => {
				const request = await this.transport.websocketRequest(this.path, { query: this.query });
				return new WebSocketChannel<never, LogLine[]>({
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
			BufferingPolicy.bufferingNewest(1),
			signal
		);
	}
}
