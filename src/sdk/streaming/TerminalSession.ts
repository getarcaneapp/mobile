import { encodeUTF8 } from '../http/json';
import type { ArcaneTransport } from '../client/ArcaneTransport';
import type { QueryItem } from '../client/url';
import { WebSocketChannel } from './WebSocketChannel';
import type { WebSocketStreamConfig } from './Streams';

export interface TerminalSize {
	cols: number;
	rows: number;
}

const clampDimension = (value: number) => Math.min(65_535, Math.max(1, Math.floor(value)));

export function terminalQuery(shell: string, size?: TerminalSize): QueryItem[] {
	const query: QueryItem[] = [{ name: 'shell', value: shell }];
	if (size) {
		query.push({ name: 'cols', value: String(clampDimension(size.cols)) });
		query.push({ name: 'rows', value: String(clampDimension(size.rows)) });
	}
	return query;
}

export function terminalResizeFrame(size: TerminalSize): string {
	return JSON.stringify({
		type: 'resize',
		cols: clampDimension(size.cols),
		rows: clampDimension(size.rows)
	});
}

export class TerminalSession {
	private readonly channel: WebSocketChannel<string, Uint8Array>;
	private outputStream: AsyncIterable<Uint8Array> | undefined;

	private constructor(channel: WebSocketChannel<string, Uint8Array>) {
		this.channel = channel;
	}

	get output(): AsyncIterable<Uint8Array> {
		this.outputStream ??= this.channel.messages();
		return this.outputStream;
	}

	static async connect(
		transport: ArcaneTransport,
		path: string,
		shell: string,
		config: WebSocketStreamConfig = transport.webSocketConfig,
		size?: TerminalSize
	): Promise<TerminalSession> {
		const request = await transport.websocketRequest(path, {
			query: terminalQuery(shell, size)
		});
		const channel = new WebSocketChannel<string, Uint8Array>({
			request,
			factory: config.factory,
			idleTimeoutMs: config.idleTimeoutMs,
			signal: transport.defaultSignal,
			encodeOutbound: (text) => ({ kind: 'string', value: text }),
			decodeInbound: (message) =>
				message.kind === 'string' ? encodeUTF8(message.value) : message.value
		});
		return new TerminalSession(channel);
	}

	send(text: string): Promise<void> {
		return this.channel.send(text);
	}

	resize(size: TerminalSize): Promise<void> {
		return this.channel.send(terminalResizeFrame(size));
	}

	close(): Promise<void> {
		return this.channel.close();
	}
}
