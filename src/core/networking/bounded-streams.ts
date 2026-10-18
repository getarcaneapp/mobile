import { withoutSwarmLogDetails } from './swarm-log-details';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { ArcaneError, CancellationError } from '@/sdk/errors/ArcaneError';
import { encodeUTF8 } from '@/sdk/http/json';
import { BufferingPolicy } from '@/sdk/streaming/AsyncQueue';
import { decodeLogFrame } from '@/sdk/streaming/Streams';
import { WebSocketChannel, type WebSocketMessage } from '@/sdk/streaming/WebSocketChannel';
import type { LogLine } from '@/sdk/types/streaming/LogLine';

import {
	RemoteDataLimitError,
	RemoteDataLimits,
	boundedText,
	utf8ByteLength
} from './remote-data-limits';

function checkFrame(message: WebSocketMessage, maximumBytes: number) {
	if (message.kind === 'string') {
		if (message.value.length * 3 <= maximumBytes) return;
		if (utf8ByteLength(message.value) > maximumBytes)
			throw RemoteDataLimitError.responseTooLarge(maximumBytes);
		return;
	}
	if (message.value.byteLength > maximumBytes)
		throw RemoteDataLimitError.responseTooLarge(maximumBytes);
}

function boundedLogLine(line: LogLine): LogLine {
	return {
		text: boundedText(line.text, RemoteDataLimits.maximumStreamLineBytes),
		seq: line.seq,
		level: line.level === undefined ? undefined : boundedText(line.level, 64),
		service: line.service === undefined ? undefined : boundedText(line.service, 256),
		timestamp: line.timestamp === undefined ? undefined : boundedText(line.timestamp, 256)
	};
}

export function boundedLogStream(
	client: ArcaneClient,
	path: string,
	query: { name: string; value?: string }[],
	signal: AbortSignal
): AsyncIterable<LogLine> {
	const transport = client.transport;
	return {
		async *[Symbol.asyncIterator]() {
			if (signal.aborted) throw new CancellationError();
			const request = await transport.websocketRequest(path, {
				query: [...query, { name: 'format', value: 'json' }]
			});
			if (signal.aborted) throw new CancellationError();
			const channel = new WebSocketChannel<never, LogLine>({
				request,
				factory: transport.webSocketConfig.factory,
				idleTimeoutMs: transport.webSocketConfig.idleTimeoutMs,
				signal,
				encodeOutbound: () => {
					throw new Error('Log streams are receive-only');
				},
				decodeInbound: (message) => {
					checkFrame(message, RemoteDataLimits.maximumStreamLineBytes);
					return boundedLogLine(decodeLogFrame(message));
				}
			});
			try {
				for await (const line of channel.messages(BufferingPolicy.bufferingNewest(100))) yield line;
			} finally {
				channel.closeImmediately();
			}
		}
	};
}

function boundedLogs(
	client: ArcaneClient,
	path: string,
	tail: string,
	timestamps: boolean,
	signal: AbortSignal
) {
	return boundedLogStream(
		client,
		path,
		[
			{ name: 'follow', value: 'true' },
			{ name: 'tail', value: tail },
			{ name: 'timestamps', value: timestamps ? 'true' : 'false' }
		],
		signal
	);
}

export function boundedContainerLogs(
	client: ArcaneClient,
	args: { envID: EnvironmentID; id: string; timestamps: boolean },
	signal: AbortSignal
) {
	const path = client.rest.environmentPath(
		args.envID,
		`ws/containers/${encodeURIComponent(args.id)}/logs`
	);
	return boundedLogs(client, path, '100', args.timestamps, signal);
}

export function boundedProjectLogs(
	client: ArcaneClient,
	args: { envID: EnvironmentID; projectID: string; timestamps: boolean },
	signal: AbortSignal
) {
	const path = client.rest.environmentPath(
		args.envID,
		`ws/projects/${encodeURIComponent(args.projectID)}/logs`
	);
	return boundedLogs(client, path, '200', args.timestamps, signal);
}

export function boundedSwarmServiceLogs(
	client: ArcaneClient,
	args: { envID: EnvironmentID; serviceID: string; timestamps: boolean },
	signal: AbortSignal
) {
	const path = client.rest.environmentPath(
		args.envID,
		`ws/swarm/services/${encodeURIComponent(args.serviceID)}/logs`
	);
	const lines = boundedLogs(client, path, '200', args.timestamps, signal);
	return {
		async *[Symbol.asyncIterator]() {
			for await (const line of lines) yield { ...line, text: withoutSwarmLogDetails(line.text) };
		}
	};
}

export class BoundedTerminalSession {
	readonly output: AsyncIterable<Uint8Array>;

	private constructor(private readonly channel: WebSocketChannel<string, Uint8Array>) {
		this.output = channel.messages(BufferingPolicy.bufferingNewest(100));
	}

	static async connect(
		client: ArcaneClient,
		path: string,
		shell: string
	): Promise<BoundedTerminalSession> {
		const transport = client.transport;
		const request = await transport.websocketRequest(path, {
			query: [{ name: 'shell', value: shell }]
		});
		const channel = new WebSocketChannel<string, Uint8Array>({
			request,
			factory: transport.webSocketConfig.factory,
			idleTimeoutMs: transport.webSocketConfig.idleTimeoutMs,
			encodeOutbound: (text) => ({ kind: 'string', value: text }),
			decodeInbound: (message) => {
				checkFrame(message, RemoteDataLimits.maximumTerminalFrameBytes);
				if (message.kind === 'string') return encodeUTF8(message.value);
				if (message.value instanceof Uint8Array) return message.value;
				throw ArcaneError.transport('Unsupported terminal frame');
			}
		});
		return new BoundedTerminalSession(channel);
	}

	send(text: string): Promise<void> {
		return this.channel.send(boundedText(text, 16 * 1_024));
	}

	close(): Promise<void> {
		return this.channel.close();
	}
}

export function boundedExec(
	client: ArcaneClient,
	args: { envID: EnvironmentID; id: string; shell?: string }
) {
	const path = client.rest.environmentPath(
		args.envID,
		`ws/containers/${encodeURIComponent(args.id)}/terminal`
	);
	return BoundedTerminalSession.connect(client, path, args.shell ?? '/bin/sh');
}
