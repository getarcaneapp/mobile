import {
	ArcaneError,
	ArcaneTimeoutError,
	CancellationError,
	arcaneErrorFrom,
	normalizedTransportError
} from '../errors/ArcaneError';
import type { AuthManager } from '../auth/AuthManager';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';
import { decodeArray, type Decoder } from '../models/base/decoding';
import {
	DEFAULT_REQUEST_TIMEOUT_MS,
	readText,
	send,
	sleep,
	type FetchInitLike,
	type FetchLike,
	type FetchResponseLike
} from '../http/fetching';
import { decodeUTF8, encodeArcaneJSON, parseArcaneJSON } from '../http/json';
import { makeMultipartFormData, singleURIPartUpload, type MultipartFile } from '../http/multipart';
import { withStreamingUploads } from '../http/streaming-upload';
import { ArcaneRequestOptions } from '../http/requestOptions';
import type { ArcaneHTTPResponseInfo, ArcaneProxySession } from '../types/proxySession';
import { RetryPolicy } from './environment';
import {
	ProxyRequestSupport,
	getHeader,
	setHeader,
	type PreparedRequest
} from './proxyRequestSupport';
import { appendingAPIPath, webSocketURL, withQueryItems, type QueryItem } from './url';
import { NDJSONStream } from '../streaming/NDJSONStream';
import type { WebSocketStreamConfig } from '../streaming/Streams';

const STREAM_ACCEPT = 'application/x-ndjson, application/x-json-stream, application/json';
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

export type RequestBody = string | ArrayBuffer | Uint8Array | Blob | FormData;

export interface TransportConfig {
	baseURL: string;
	authManager: AuthManager;
	fetch: FetchLike;
	streamingFetch: FetchLike;
	retryPolicy?: RetryPolicy;
	additionalHeaders?: Record<string, string>;
	proxySession?: ArcaneProxySession;
	timeoutMs?: number;
	defaultRequestOptions?: ArcaneRequestOptions;
	defaultSignal?: AbortSignal;
	webSocket?: WebSocketStreamConfig;
}

export interface TransportRequestOptions {
	method?: string;
	query?: QueryItem[];
	authorized?: boolean;
	options?: ArcaneRequestOptions;
	signal?: AbortSignal;
}

export interface ArcaneAuthorizedRequest {
	url: string;
	headers: Record<string, string>;
}

export interface ByteStreamResult {
	http: ArcaneHTTPResponseInfo;
	bytes: AsyncIterable<Uint8Array>;
	cancel(): void;
}

interface AuthenticatedRequest {
	request: PreparedRequest;
	credentialGeneration: number | undefined;
}

function isRetryableNetworkError(error: unknown): boolean {
	if (error instanceof CancellationError || error instanceof ArcaneTimeoutError) return false;
	return error instanceof TypeError;
}

function linkAbort(signals: (AbortSignal | undefined)[]): {
	signal: AbortSignal | undefined;
	dispose: () => void;
} {
	const present = signals.filter((s): s is AbortSignal => s !== undefined);
	if (present.length === 0) return { signal: undefined, dispose: () => undefined };
	if (present.length === 1) return { signal: present[0], dispose: () => undefined };
	const controller = new AbortController();
	const listeners: [AbortSignal, () => void][] = [];
	for (const signal of present) {
		if (signal.aborted) {
			controller.abort(signal.reason);
			break;
		}
		const onAbort = () => controller.abort(signal.reason);
		signal.addEventListener('abort', onAbort);
		listeners.push([signal, onAbort]);
	}
	return {
		signal: controller.signal,
		dispose: () => listeners.forEach(([signal, fn]) => signal.removeEventListener('abort', fn))
	};
}

async function* readBody(response: FetchResponseLike): AsyncGenerator<Uint8Array, void, undefined> {
	const body = response.body;
	if (body && typeof body.getReader === 'function') {
		const reader = body.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) return;
				if (value && value.byteLength > 0) yield value;
			}
		} finally {
			try {
				await reader.cancel();
			} catch {}
		}
	}
	const buffer = await response.arrayBuffer();
	if (buffer.byteLength > 0) yield new Uint8Array(buffer);
}

export class ArcaneTransport {
	readonly baseURL: string;
	readonly authManager: AuthManager;
	readonly retryPolicy: RetryPolicy;
	readonly proxySupport: ProxyRequestSupport;
	readonly defaultRequestOptions: ArcaneRequestOptions;
	readonly defaultSignal: AbortSignal | undefined;
	readonly timeoutMs: number;
	readonly webSocketConfig: WebSocketStreamConfig;
	private readonly fetchImpl: FetchLike;
	private readonly streamingFetchImpl: FetchLike;
	private readonly config: TransportConfig;

	constructor(config: TransportConfig) {
		this.config = config;
		this.baseURL = config.baseURL;
		this.authManager = config.authManager;
		this.fetchImpl = withStreamingUploads(config.fetch);
		this.streamingFetchImpl = withStreamingUploads(config.streamingFetch);
		this.retryPolicy = config.retryPolicy ?? RetryPolicy.default;
		this.timeoutMs = config.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
		this.defaultRequestOptions = config.defaultRequestOptions ?? ArcaneRequestOptions.none();
		this.defaultSignal = config.defaultSignal;
		this.webSocketConfig = config.webSocket ?? {};
		this.proxySupport = new ProxyRequestSupport(
			config.baseURL,
			config.additionalHeaders ?? {},
			config.proxySession
		);
	}

	withRequestOptions(options: ArcaneRequestOptions): ArcaneTransport {
		return new ArcaneTransport({ ...this.config, defaultRequestOptions: options });
	}

	withSignal(signal: AbortSignal): ArcaneTransport {
		return new ArcaneTransport({ ...this.config, defaultSignal: signal });
	}

	decode<T>(text: string, decode?: Decoder<T>): T {
		try {
			const raw = text.trim() === '' ? undefined : parseArcaneJSON(text);
			return decode ? decode(raw) : (raw as T);
		} catch (error) {
			if (error instanceof ArcaneError) throw error;
			throw ArcaneError.decoding(String(error));
		}
	}

	decodeEnvelope<T>(text: string, decode?: Decoder<T>): T {
		try {
			const raw = parseArcaneJSON(text);
			if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
				throw new Error('Expected APIResponse envelope object');
			}
			const envelope = raw as { success?: unknown; data?: unknown };
			if (typeof envelope.success !== 'boolean')
				throw new Error('Missing "success" in APIResponse');
			return decode ? decode(envelope.data) : (envelope.data as T);
		} catch (error) {
			if (error instanceof ArcaneError) throw error;
			throw ArcaneError.decoding(String(error));
		}
	}

	async request<T>(
		path: string,
		init: TransportRequestOptions & { body?: unknown; decode?: Decoder<T> } = {}
	): Promise<T> {
		const text = await this.rawRequest(path, init);
		return this.decodeEnvelope(text, init.decode);
	}

	async paginated<T>(
		path: string,
		init: {
			start: number;
			limit: number;
			query?: QueryItem[];
			options?: ArcaneRequestOptions;
			signal?: AbortSignal;
			decode?: Decoder<T>;
		}
	): Promise<PaginatedResponse<T>> {
		const query = [
			...(init.query ?? []),
			{ name: 'start', value: String(Math.max(0, init.start)) },
			{ name: 'limit', value: String(init.limit) }
		];
		const text = await this.rawRequest(path, {
			query,
			authorized: true,
			options: init.options,
			signal: init.signal
		});
		return this.decode(text, (raw) => decodePaginatedResponse(raw, init.decode));
	}

	async rawRequest(
		path: string,
		init: TransportRequestOptions & { body?: unknown } = {}
	): Promise<string> {
		const bytes = await this.rawDataRequest(path, {
			method: init.method ?? 'GET',
			query: init.query,
			body: init.body === undefined ? undefined : encodeArcaneJSON(init.body),
			contentType: 'application/json',
			authorized: init.authorized,
			options: init.options,
			signal: init.signal,
			expectsJSONResponse: true
		});
		return decodeUTF8(bytes);
	}

	async rawDataRequest(
		path: string,
		init: TransportRequestOptions & {
			body?: RequestBody;
			contentType?: string;
			expectsJSONResponse?: boolean;
			accept?: string;
		} = {}
	): Promise<Uint8Array> {
		const method = init.method ?? 'PUT';
		const authorized = init.authorized ?? true;
		const requestOptions = this.resolvedRequestOptions(init.options);
		const linked = linkAbort([this.defaultSignal, init.signal]);
		let didRefresh = false;
		let attempt = 1;
		try {
			while (true) {
				const request = this.makeRequest(
					path,
					method,
					init.query ?? [],
					init.accept ?? 'application/json'
				);
				if (init.body !== undefined && !(init.body instanceof FormData)) {
					setHeader(
						request.headers,
						'Content-Type',
						init.contentType ?? 'application/octet-stream'
					);
				}
				this.applyRequestOptions(request, requestOptions);
				const generation = await this.applyAuthenticationHeaders(request, authorized);
				try {
					const delegate = await this.proxySupport.prepare(request);
					const { response, info, release } = await send(this.fetchImpl, request, {
						body: init.body,
						signal: linked.signal,
						timeoutMs: this.timeoutMs
					});
					let bytes: Uint8Array;
					try {
						bytes = new Uint8Array(await response.arrayBuffer());
					} catch (error) {
						if (linked.signal?.aborted) throw new CancellationError();
						throw error;
					} finally {
						release();
					}
					const text = decodeUTF8(bytes.subarray(0, 4096));
					await delegate.receive(info);
					this.proxySupport.check(info, text, init.expectsJSONResponse ?? false);

					if (
						await this.refreshAuthorizationIfNeeded(
							response.status,
							authorized,
							didRefresh,
							getHeader(request.headers, 'Authorization')
						)
					) {
						didRefresh = true;
						continue;
					}

					if (this.shouldRetry(method, response.status) && attempt < this.retryPolicy.maxAttempts) {
						await this.sleepBeforeRetry(attempt, linked.signal);
						attempt += 1;
						continue;
					}

					if (response.status < 200 || response.status >= 300) {
						if (response.status === 401 && generation !== undefined) {
							await this.authManager
								.clearIfCredentialGenerationMatches(generation)
								.catch(() => undefined);
						}
						throw arcaneErrorFrom(response.status, decodeUTF8(bytes), response.headers);
					}
					return bytes;
				} catch (error) {
					if (error instanceof ArcaneError) throw error;
					if (error instanceof CancellationError) throw new CancellationError();
					if (
						this.isIdempotent(method) &&
						isRetryableNetworkError(error) &&
						attempt < this.retryPolicy.maxAttempts
					) {
						await this.sleepBeforeRetry(attempt, linked.signal);
						attempt += 1;
						continue;
					}
					throw normalizedTransportError(error);
				}
			}
		} finally {
			linked.dispose();
		}
	}

	downloadRaw(
		path: string,
		init: {
			query?: QueryItem[];
			authorized?: boolean;
			options?: ArcaneRequestOptions;
			signal?: AbortSignal;
		} = {}
	): Promise<Uint8Array> {
		return this.rawDataRequest(path, {
			method: 'GET',
			query: init.query,
			authorized: init.authorized,
			options: init.options,
			signal: init.signal,
			accept: 'application/octet-stream'
		});
	}

	async downloadRequest(
		path: string,
		init: { query?: QueryItem[]; options?: ArcaneRequestOptions } = {}
	): Promise<ArcaneAuthorizedRequest> {
		const request = this.makeRequest(path, 'GET', init.query ?? [], 'application/octet-stream');
		this.applyRequestOptions(request, this.resolvedRequestOptions(init.options));
		await this.applyAuthenticationHeaders(request, true);
		await this.proxySupport.prepare(request);
		return { url: request.url, headers: request.headers };
	}

	async websocketRequest(
		path: string,
		init: { query?: QueryItem[]; options?: ArcaneRequestOptions } = {}
	): Promise<ArcaneAuthorizedRequest> {
		const request: PreparedRequest = {
			url: webSocketURL(withQueryItems(appendingAPIPath(this.baseURL, path), init.query ?? [])),
			method: 'GET',
			headers: {},
			handleCookies: true
		};
		this.applyRequestOptions(request, this.resolvedRequestOptions(init.options));
		await this.applyAuthenticationHeaders(request, true);
		await this.proxySupport.prepare(request);
		return { url: request.url, headers: request.headers };
	}

	async byteStream(
		path: string,
		init: TransportRequestOptions & {
			body?: RequestBody;
			contentType?: string;
			accept?: string;
		} = {}
	): Promise<ByteStreamResult> {
		const method = init.method ?? 'GET';
		const accept = init.accept ?? STREAM_ACCEPT;
		const authorized = init.authorized ?? true;
		const requestOptions = this.resolvedRequestOptions(init.options);
		let didRefresh = false;
		while (true) {
			const request = this.makeRequest(path, method, init.query ?? [], accept);
			this.applyRequestOptions(request, requestOptions);
			const generation = await this.applyAuthenticationHeaders(request, authorized);
			if (
				init.body !== undefined &&
				init.contentType !== undefined &&
				!(init.body instanceof FormData)
			) {
				setHeader(request.headers, 'Content-Type', init.contentType);
			}
			const result = await this.openStream(
				request,
				init.body,
				init.signal,
				accept.toLowerCase().includes('json')
			);
			if (
				await this.refreshAuthorizationIfNeeded(
					result.http.status,
					authorized,
					didRefresh,
					getHeader(request.headers, 'Authorization')
				)
			) {
				result.cancel();
				didRefresh = true;
				continue;
			}
			if (result.http.status === 401 && generation !== undefined) {
				await this.authManager
					.clearIfCredentialGenerationMatches(generation)
					.catch(() => undefined);
			}
			return result;
		}
	}

	private async openStream(
		request: PreparedRequest,
		body: RequestBody | undefined,
		signal: AbortSignal | undefined,
		expectsJSON: boolean
	): Promise<ByteStreamResult> {
		const controller = new AbortController();
		const linked = linkAbort([this.defaultSignal, signal, controller.signal]);
		const delegate = await this.proxySupport.prepare(request);
		const usesURIParts = body instanceof FormData && formDataHasURIParts(body);
		let sent: Awaited<ReturnType<typeof send>>;
		try {
			sent = await send(usesURIParts ? this.fetchImpl : this.streamingFetchImpl, request, {
				body,
				signal: linked.signal,
				timeoutMs: singleURIPartUpload(body) ? undefined : this.timeoutMs,
				timeoutUntilHeaders: true
			});
		} catch (error) {
			linked.dispose();
			throw normalizedTransportError(error);
		}
		const { response, info } = sent;
		const cancel = () => {
			controller.abort();
			sent.release();
			linked.dispose();
		};
		try {
			await delegate.receive(info);
			this.proxySupport.check(info, undefined, expectsJSON);
			const prefix: Uint8Array[] = [];
			let bytes: AsyncIterable<Uint8Array> = readBody(response);
			if (info.status === 401 || info.status === 403) {
				const iterator = (bytes as AsyncGenerator<Uint8Array>)[Symbol.asyncIterator]();
				let size = 0;
				while (size < 4096) {
					const next = await iterator.next();
					if (next.done) break;
					prefix.push(next.value);
					size += next.value.byteLength;
				}
				const snippet = decodeUTF8(concatBytes(prefix));
				this.proxySupport.check(info, snippet, true);
				bytes = (async function* () {
					for (const chunk of prefix) yield chunk;
					while (true) {
						const next = await iterator.next();
						if (next.done) return;
						yield next.value;
					}
				})();
			}
			const guarded = (async function* () {
				try {
					for await (const chunk of bytes) yield chunk;
				} catch (error) {
					if (linked.signal?.aborted) throw new CancellationError();
					throw normalizedTransportError(error);
				} finally {
					sent.release();
					linked.dispose();
				}
			})();
			return { http: info, bytes: guarded, cancel };
		} catch (error) {
			cancel();
			throw error;
		}
	}

	async multipartUpload<T>(
		path: string,
		init: {
			method?: string;
			query?: QueryItem[];
			fields?: Record<string, string>;
			files: MultipartFile[];
			options?: ArcaneRequestOptions;
			signal?: AbortSignal;
			decode?: Decoder<T>;
		}
	): Promise<T> {
		const method = init.method ?? 'POST';
		const requestOptions = this.resolvedRequestOptions(init.options);
		const linked = linkAbort([this.defaultSignal, init.signal]);
		let didRefresh = false;
		try {
			while (true) {
				const prepared = await this.makeMultipartRequest(
					path,
					method,
					init.query ?? [],
					'application/json',
					requestOptions
				);
				const request = prepared.request;
				const delegate = await this.proxySupport.prepare(request);
				let text: string;
				let status: number;
				let headers: Headers;
				try {
					const body = makeMultipartFormData(init.fields ?? {}, init.files);
					const { response, info, release } = await send(this.fetchImpl, request, {
						body,
						signal: linked.signal,
						timeoutMs: singleURIPartUpload(body) ? undefined : this.timeoutMs,
						timeoutUntilHeaders: true
					});
					try {
						text = await readText(response, linked.signal);
					} finally {
						release();
					}
					await delegate.receive(info);
					this.proxySupport.check(info, text);
					status = response.status;
					headers = response.headers;
				} catch (error) {
					if (error instanceof ArcaneError) throw error;
					throw normalizedTransportError(error);
				}
				if (await this.refreshAuthorizationIfNeeded(status, true, didRefresh)) {
					didRefresh = true;
					continue;
				}
				if (status < 200 || status >= 300) {
					if (status === 401 && prepared.credentialGeneration !== undefined) {
						await this.authManager
							.clearIfCredentialGenerationMatches(prepared.credentialGeneration)
							.catch(() => undefined);
					}
					throw arcaneErrorFrom(status, text, headers);
				}
				return this.decodeEnvelope(text, init.decode);
			}
		} finally {
			linked.dispose();
		}
	}

	multipartUploadStream<Element>(
		path: string,
		init: {
			method?: string;
			query?: QueryItem[];
			fields?: Record<string, string>;
			files: MultipartFile[];
			options?: ArcaneRequestOptions;
			decode?: Decoder<Element>;
		}
	): NDJSONStream<Element> {
		const transport = init.options ? this.withRequestOptions(init.options) : this;
		return NDJSONStream.multipart<Element>(
			transport,
			{
				path,
				method: init.method ?? 'POST',
				query: init.query ?? [],
				fields: init.fields ?? {},
				files: init.files
			},
			init.decode
		);
	}

	async multipartByteStream(
		path: string,
		init: {
			method: string;
			query: QueryItem[];
			fields: Record<string, string>;
			files: MultipartFile[];
			signal?: AbortSignal;
		}
	): Promise<ByteStreamResult> {
		let didRefresh = false;
		while (true) {
			const prepared = await this.makeMultipartRequest(
				path,
				init.method,
				init.query,
				STREAM_ACCEPT,
				this.resolvedRequestOptions(undefined)
			);
			const result = await this.openStream(
				prepared.request,
				makeMultipartFormData(init.fields, init.files),
				init.signal,
				true
			);
			if (await this.refreshAuthorizationIfNeeded(result.http.status, true, didRefresh)) {
				result.cancel();
				didRefresh = true;
				continue;
			}
			if (result.http.status === 401 && prepared.credentialGeneration !== undefined) {
				await this.authManager
					.clearIfCredentialGenerationMatches(prepared.credentialGeneration)
					.catch(() => undefined);
			}
			return result;
		}
	}

	private makeRequest(
		path: string,
		method: string,
		query: QueryItem[],
		accept: string
	): PreparedRequest {
		return {
			url: withQueryItems(appendingAPIPath(this.baseURL, path), query),
			method,
			headers: { Accept: accept },
			handleCookies: true
		};
	}

	private async makeMultipartRequest(
		path: string,
		method: string,
		query: QueryItem[],
		accept: string,
		options: ArcaneRequestOptions
	): Promise<AuthenticatedRequest> {
		const request = this.makeRequest(path, method, query, accept);
		this.applyRequestOptions(request, options);
		const credentialGeneration = await this.applyAuthenticationHeaders(request, true);
		return { request, credentialGeneration };
	}

	async applyAuthenticationHeaders(
		request: PreparedRequest,
		authorized = true
	): Promise<number | undefined> {
		if (!authorized) return undefined;
		const context = await this.authManager.authenticationContext();
		for (const [key, value] of Object.entries(context.headers))
			setHeader(request.headers, key, value);
		return context.headers.Authorization === undefined ? undefined : context.credentialGeneration;
	}

	async refreshAuthorizationIfNeeded(
		statusCode: number,
		authorized: boolean,
		didRefresh: boolean,
		sentAuthorization?: string
	): Promise<boolean> {
		if (statusCode !== 401 || !authorized || didRefresh) return false;
		if (!(await this.authManager.hasRefreshCredential())) return false;
		const current = this.authManager.currentAuthorizationHeader();
		if (sentAuthorization !== undefined && current !== undefined && current !== sentAuthorization) {
			return true;
		}
		await this.authManager.refreshTokens();
		return true;
	}

	resolvedRequestOptions(options: ArcaneRequestOptions | undefined): ArcaneRequestOptions {
		return options ?? this.defaultRequestOptions;
	}

	private applyRequestOptions(request: PreparedRequest, options: ArcaneRequestOptions): void {
		if (options.activityBatchID !== undefined) {
			setHeader(request.headers, 'X-Arcane-Batch-Id', options.activityBatchID);
		}
		if (options.stepUpToken !== undefined) {
			setHeader(request.headers, 'X-Step-Up-Token', options.stepUpToken);
		}
	}

	private isIdempotent(method: string): boolean {
		return IDEMPOTENT_METHODS.has(method.toUpperCase());
	}

	shouldRetry(method: string, statusCode: number): boolean {
		if (!this.isIdempotent(method)) return false;
		return [429, 502, 503, 504].includes(statusCode);
	}

	private sleepBeforeRetry(attempt: number, signal: AbortSignal | undefined): Promise<void> {
		return sleep(this.retryDelay(attempt), signal);
	}

	retryDelay(attempt: number): number {
		const cap = Math.max(0, this.retryPolicy.maxBackoffMs);
		let delay = Math.min(Math.max(0, this.retryPolicy.baseBackoffMs), cap);
		if (delay <= 0 || attempt <= 1) return delay;
		for (let i = 1; i < attempt; i += 1) {
			if (delay >= cap) break;
			if (delay >= cap - delay) return cap;
			delay *= 2;
		}
		return delay;
	}
}

export { ArcaneTransport as ArcaneURLSessionTransport };

function concatBytes(chunks: Uint8Array[]): Uint8Array {
	const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
	const out = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}

function formDataHasURIParts(form: FormData): boolean {
	const parts = (form as unknown as { getParts?: () => { uri?: unknown }[] }).getParts?.();
	return Array.isArray(parts) && parts.some((part) => typeof part?.uri === 'string');
}

export function decodePaginatedResponse<T>(
	raw: unknown,
	decode?: Decoder<T>
): PaginatedResponse<T> {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		throw new Error('Expected PaginatedResponse object');
	}
	const o = raw as { success?: unknown; data?: unknown; pagination?: unknown };
	if (typeof o.success !== 'boolean') throw new Error('Missing "success" in PaginatedResponse');
	if (typeof o.pagination !== 'object' || o.pagination === null) {
		throw new Error('Missing "pagination" in PaginatedResponse');
	}
	return {
		success: o.success,
		data: decode ? decodeArray(decode)(o.data ?? []) : ((o.data ?? []) as T[]),
		pagination: o.pagination as PaginatedResponse<T>['pagination']
	};
}

export type { FetchInitLike };
