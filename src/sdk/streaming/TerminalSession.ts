import { encodeUTF8 } from '../http/json';
import type { ArcaneTransport } from '../client/ArcaneTransport';
import { WebSocketChannel } from './WebSocketChannel';
import type { WebSocketStreamConfig } from './Streams';

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
		config: WebSocketStreamConfig = transport.webSocketConfig
	): Promise<TerminalSession> {
		const request = await transport.websocketRequest(path, {
			query: [{ name: 'shell', value: shell }]
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

	close(): Promise<void> {
		return this.channel.close();
	}
}
