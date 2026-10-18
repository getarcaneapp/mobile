import {
	ArcaneError,
	CancellationError,
	arcaneErrorFrom,
	normalizedTransportError
} from '../errors/ArcaneError';
import type { ArcaneTransport, ByteStreamResult, RequestBody } from '../client/ArcaneTransport';
import type { QueryItem } from '../client/url';
import type { Decoder } from '../models/base/decoding';
import { decodeUTF8, parseArcaneJSON } from '../http/json';
import type { MultipartEndpoint } from '../http/multipart';

export type NDJSONStreamTerminalAction =
	| { kind: 'continueStreaming' }
	| { kind: 'finish' }
	| { kind: 'fail'; error: ArcaneError };

type Source =
	| { kind: 'body'; method: string; body?: RequestBody; contentType?: string; query: QueryItem[] }
	| { kind: 'multipart'; endpoint: MultipartEndpoint };

export interface NDJSONStreamInit<Element> {
	path: string;
	method: string;
	body?: RequestBody;
	contentType?: string | null;
	query?: QueryItem[];
	notFoundFallback?: { path: string; query: QueryItem[] };
	terminalAction?: (element: Element) => NDJSONStreamTerminalAction;
	decode?: Decoder<Element>;
	signal?: AbortSignal;
}

export async function* lines(
	bytes: AsyncIterable<Uint8Array>
): AsyncGenerator<string, void, undefined> {
	const decoder = new TextDecoder();
	let buffer = '';
	for await (const chunk of bytes) {
		buffer += decoder.decode(chunk, { stream: true });
		const complete: string[] = [];
		let start = 0;
		for (let index = 0; index < buffer.length; index++) {
			const code = buffer.charCodeAt(index);
			if (code === 10) {
				complete.push(buffer.slice(start, index));
				start = index + 1;
			} else if (code === 13) {
				if (index === buffer.length - 1) break;
				complete.push(buffer.slice(start, index));
				if (buffer.charCodeAt(index + 1) === 10) index += 1;
				start = index + 1;
			}
		}
		if (start > 0) buffer = buffer.slice(start);
		for (const line of complete) yield line;
	}
	buffer += decoder.decode();
	const rest = buffer.replace(/\r$/, '');
	if (rest !== '') yield rest;
}

export function decodeNDJSONLine<Element>(
	line: string,
	decode?: Decoder<Element>
): Element | undefined {
	let trimmed = line.trim();
	if (trimmed.startsWith('data:')) trimmed = trimmed.slice(5).trim();
	if (trimmed === '') return undefined;
	try {
		const raw = parseArcaneJSON(trimmed);
		return decode ? decode(raw) : (raw as Element);
	} catch (error) {
		if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined;
		throw ArcaneError.decoding(String(error));
	}
}

export class NDJSONStream<Element> implements AsyncIterable<Element> {
	private readonly transport: ArcaneTransport;
	private readonly init: NDJSONStreamInit<Element>;
	private readonly multipartEndpoint: MultipartEndpoint | undefined;
	private readonly path: string;
	private readonly source: Source;
	private readonly notFoundFallback: { path: string; source: Source } | undefined;
	private readonly terminalAction: ((element: Element) => NDJSONStreamTerminalAction) | undefined;
	private readonly decoder: Decoder<Element> | undefined;
	private readonly signal: AbortSignal | undefined;

	constructor(
		transport: ArcaneTransport,
		init: NDJSONStreamInit<Element>,
		multipartEndpoint?: MultipartEndpoint
	) {
		this.transport = transport;
		this.init = init;
		this.multipartEndpoint = multipartEndpoint;
		this.path = init.path;
		this.decoder = init.decode;
		this.signal = init.signal;
		if (multipartEndpoint) {
			this.source = { kind: 'multipart', endpoint: multipartEndpoint };
			this.notFoundFallback = undefined;
			this.terminalAction = undefined;
		} else {
			const contentType =
				init.contentType === null ? undefined : (init.contentType ?? 'application/json');
			const bodySource = (query: QueryItem[]): Source => ({
				kind: 'body',
				method: init.method,
				body: init.body,
				contentType,
				query
			});
			this.source = bodySource(init.query ?? []);
			this.notFoundFallback = init.notFoundFallback
				? { path: init.notFoundFallback.path, source: bodySource(init.notFoundFallback.query) }
				: undefined;
			this.terminalAction = init.terminalAction;
		}
	}

	static multipart<Element>(
		transport: ArcaneTransport,
		endpoint: MultipartEndpoint,
		decode?: Decoder<Element>
	): NDJSONStream<Element> {
		return new NDJSONStream<Element>(
			transport,
			{ path: endpoint.path, method: endpoint.method, decode },
			endpoint
		);
	}

	withSignal(signal: AbortSignal): NDJSONStream<Element> {
		return new NDJSONStream<Element>(
			this.transport.withSignal(signal),
			{ ...this.init, signal },
			this.multipartEndpoint
		);
	}

	async collect(): Promise<Element[]> {
		const out: Element[] = [];
		for await (const element of this) out.push(element);
		return out;
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<Element, void, undefined> {
		let result: ByteStreamResult | undefined;
		try {
			result = await this.openByteStream(this.path, this.source, this.notFoundFallback);
			if (result.http.status < 200 || result.http.status >= 300) {
				const chunks: Uint8Array[] = [];
				let size = 0;
				for await (const chunk of result.bytes) {
					chunks.push(chunk);
					size += chunk.byteLength;
					if (size > 4096) break;
				}
				const snippet = new Uint8Array(size);
				let offset = 0;
				for (const chunk of chunks) {
					snippet.set(chunk, offset);
					offset += chunk.byteLength;
				}
				throw arcaneErrorFrom(result.http.status, decodeUTF8(snippet), result.http.headers);
			}
			for await (const line of lines(result.bytes)) {
				if (this.signal?.aborted) break;
				const element = decodeNDJSONLine(line, this.decoder);
				if (element === undefined) continue;
				const action = this.terminalAction?.(element) ?? { kind: 'continueStreaming' };
				if (action.kind === 'fail') throw action.error;
				yield element;
				if (action.kind === 'finish') return;
			}
		} catch (error) {
			throw normalizedTransportError(error);
		} finally {
			result?.cancel();
		}
	}

	private async openByteStream(
		path: string,
		source: Source,
		notFoundFallback?: { path: string; source: Source }
	): Promise<ByteStreamResult> {
		let result: ByteStreamResult;
		if (source.kind === 'body') {
			result = await this.transport.byteStream(path, {
				method: source.method,
				query: source.query,
				body: source.body,
				contentType: source.contentType,
				signal: this.signal
			});
		} else {
			result = await this.transport.multipartByteStream(source.endpoint.path, {
				method: source.endpoint.method,
				query: source.endpoint.query,
				fields: source.endpoint.fields,
				files: source.endpoint.files,
				signal: this.signal
			});
		}
		if (result.http.status === 404 && notFoundFallback) {
			result.cancel();
			if (this.signal?.aborted) throw new CancellationError();
			return this.openByteStream(notFoundFallback.path, notFoundFallback.source);
		}
		return result;
	}
}
