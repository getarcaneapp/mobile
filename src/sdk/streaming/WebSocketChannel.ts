import { ArcaneError, CancellationError } from '../errors/ArcaneError';
import type { ArcaneAuthorizedRequest } from '../client/ArcaneTransport';
import { AsyncQueue, BufferingPolicy } from './AsyncQueue';

export type WebSocketMessage =
	| { kind: 'string'; value: string }
	| { kind: 'data'; value: Uint8Array };

export interface WebSocketLike {
	binaryType: string;
	readonly readyState: number;
	onopen: ((event: unknown) => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
	onerror: ((event: unknown) => void) | null;
	onclose: ((event: { code?: number; reason?: string }) => void) | null;
	send(data: string | ArrayBuffer | ArrayBufferView): void;
	close(code?: number, reason?: string): void;
}

export type WebSocketFactory = (
	url: string,
	protocols: string[] | undefined,
	options: { headers: Record<string, string> }
) => WebSocketLike;

export const defaultWebSocketFactory: WebSocketFactory = (url, protocols, options) => {
	const Ctor = (
		globalThis as unknown as {
			WebSocket?: new (
				url: string,
				protocols?: string[],
				options?: { headers: Record<string, string> }
			) => WebSocketLike;
		}
	).WebSocket;
	if (!Ctor) throw ArcaneError.transport('WebSocket is not available in this environment');
	return new Ctor(url, protocols, options);
};

export const arcaneWebSocketDefaultPingIntervalMs = 25_000;

const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

export interface WebSocketChannelInit<Outbound, Inbound> {
	request: ArcaneAuthorizedRequest;
	encodeOutbound: (value: Outbound) => WebSocketMessage;
	decodeInbound: (message: WebSocketMessage) => Inbound;
	factory?: WebSocketFactory;
	protocols?: string[];
	idleTimeoutMs?: number;
	signal?: AbortSignal;
}

function toMessage(data: unknown): WebSocketMessage {
	if (typeof data === 'string') return { kind: 'string', value: data };
	if (data instanceof ArrayBuffer) return { kind: 'data', value: new Uint8Array(data) };
	if (ArrayBuffer.isView(data)) {
		return { kind: 'data', value: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
	}
	return { kind: 'string', value: String(data) };
}

export class WebSocketChannel<Outbound, Inbound> {
	private readonly socket: WebSocketLike;
	private readonly encodeOutbound: (value: Outbound) => WebSocketMessage;
	private readonly decodeInbound: (message: WebSocketMessage) => Inbound;
	private readonly idleTimeoutMs: number | undefined;
	private readonly opened: Promise<void>;
	private queue: AsyncQueue<Inbound> | undefined;
	private pending: { message?: WebSocketMessage; error?: unknown; closed?: boolean }[] = [];
	private closed = false;
	private idleTimer: ReturnType<typeof setTimeout> | undefined;
	private readonly signal: AbortSignal | undefined;
	private readonly onAbort = () => this.closeImmediately();

	constructor(init: WebSocketChannelInit<Outbound, Inbound>) {
		this.encodeOutbound = init.encodeOutbound;
		this.decodeInbound = init.decodeInbound;
		this.idleTimeoutMs = init.idleTimeoutMs;
		this.signal = init.signal;
		const factory = init.factory ?? defaultWebSocketFactory;
		this.socket = factory(init.request.url, init.protocols, { headers: init.request.headers });
		this.socket.binaryType = 'arraybuffer';
		this.opened = new Promise<void>((resolve, reject) => {
			this.socket.onopen = () => {
				this.armIdleTimer();
				resolve();
			};
			this.socket.onerror = (event) => {
				const message =
					typeof (event as { message?: unknown })?.message === 'string'
						? (event as { message: string }).message
						: 'WebSocket connection failed';
				const error = ArcaneError.transport(message);
				reject(error);
				this.deliver({ error });
			};
		});
		this.opened.catch(() => undefined);
		this.socket.onmessage = (event) => {
			this.armIdleTimer();
			this.deliver({ message: toMessage(event.data) });
		};
		this.socket.onclose = (event) => {
			this.clearIdleTimer();
			const code = event.code ?? 1000;
			if (code === 1000 || code === 1001 || this.closed) this.deliver({ closed: true });
			else
				this.deliver({
					error: ArcaneError.transport(
						`WebSocket closed (${code}${event.reason ? `: ${event.reason}` : ''})`
					)
				});
		};
		if (this.signal) {
			if (this.signal.aborted) this.closeImmediately();
			else this.signal.addEventListener('abort', this.onAbort, { once: true });
		}
	}

	private armIdleTimer(): void {
		if (this.idleTimeoutMs === undefined || this.idleTimeoutMs <= 0) return;
		this.clearIdleTimer();
		this.idleTimer = setTimeout(() => {
			this.deliver({ error: ArcaneError.transport('WebSocket connection timed out') });
			this.closeImmediately();
		}, this.idleTimeoutMs);
	}

	private clearIdleTimer(): void {
		if (this.idleTimer !== undefined) clearTimeout(this.idleTimer);
		this.idleTimer = undefined;
	}

	private deliver(event: { message?: WebSocketMessage; error?: unknown; closed?: boolean }): void {
		const queue = this.queue;
		if (!queue) {
			this.pending.push(event);
			return;
		}
		if (event.message) {
			try {
				queue.yield(this.decodeInbound(event.message));
			} catch (error) {
				queue.finish(error instanceof ArcaneError ? error : ArcaneError.decoding(String(error)));
				this.closeImmediately();
			}
		} else if (event.error !== undefined) {
			queue.finish(this.closed ? undefined : event.error);
		} else if (event.closed) {
			queue.finish();
		}
	}

	messages(bufferingPolicy: BufferingPolicy = BufferingPolicy.unbounded): AsyncIterable<Inbound> {
		if (this.queue) throw new Error('WebSocketChannel.messages may only be consumed once');
		this.queue = new AsyncQueue<Inbound>(bufferingPolicy, () => this.closeImmediately());
		const pending = this.pending;
		this.pending = [];
		for (const event of pending) this.deliver(event);
		if (this.closed) this.queue.finish();
		return this.queue;
	}

	async send(value: Outbound): Promise<void> {
		if (this.closed) throw new CancellationError();
		await this.opened;
		if (this.socket.readyState !== OPEN) throw ArcaneError.transport('WebSocket is not connected');
		const message = this.encodeOutbound(value);
		this.socket.send(message.kind === 'string' ? message.value : message.value);
	}

	async close(code = 1000, reason?: string): Promise<void> {
		this.closeImmediately(code, reason);
	}

	closeImmediately(code = 1000, reason?: string): void {
		if (this.closed) return;
		this.closed = true;
		this.clearIdleTimer();
		this.signal?.removeEventListener('abort', this.onAbort);
		if (this.socket.readyState !== CLOSING && this.socket.readyState !== CLOSED) {
			try {
				this.socket.close(code, reason);
			} catch {}
		}
		this.queue?.finish();
	}
}
