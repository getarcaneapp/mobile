import { ArcaneTimeoutError, CancellationError, isAbortError } from '../errors/ArcaneError';
import type { ArcaneHTTPResponseInfo } from '../types/proxySession';
import type { PreparedRequest } from '../client/proxyRequestSupport';

export interface FetchResponseLike {
	readonly status: number;
	readonly url: string;
	readonly headers: Headers;
	readonly body: ReadableStream<Uint8Array> | null;
	text(): Promise<string>;
	arrayBuffer(): Promise<ArrayBuffer>;
}

export interface FetchInitLike {
	method?: string;
	headers?: Record<string, string>;
	body?: string | ArrayBuffer | Uint8Array | Blob | FormData | null;
	signal?: AbortSignal;
	credentials?: 'include' | 'omit' | 'same-origin';
	redirect?: 'follow' | 'manual' | 'error';
}

export type FetchLike = (input: string, init?: FetchInitLike) => Promise<FetchResponseLike>;

export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

export function linkSignals(signal: AbortSignal | undefined, timeoutMs: number | undefined) {
	const controller = new AbortController();
	let didTimeOut = false;
	const onAbort = () => controller.abort(signal?.reason);
	if (signal) {
		if (signal.aborted) controller.abort(signal.reason);
		else signal.addEventListener('abort', onAbort);
	}
	const timer =
		timeoutMs !== undefined && timeoutMs > 0 && Number.isFinite(timeoutMs)
			? setTimeout(() => {
					didTimeOut = true;
					controller.abort();
				}, timeoutMs)
			: undefined;
	return {
		signal: controller.signal,
		timedOut: () => didTimeOut,
		clearTimeout: () => {
			if (timer !== undefined) clearTimeout(timer);
		},
		dispose: () => {
			if (timer !== undefined) clearTimeout(timer);
			signal?.removeEventListener('abort', onAbort);
		}
	};
}

export function responseInfo(
	response: FetchResponseLike,
	requestURL: string
): ArcaneHTTPResponseInfo {
	return { url: response.url || requestURL, status: response.status, headers: response.headers };
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
	if (signal?.aborted) throw new CancellationError();
}

export interface SendOptions {
	body?: FetchInitLike['body'];
	signal?: AbortSignal;
	timeoutMs?: number;
	timeoutUntilHeaders?: boolean;
}

export async function send(
	fetchImpl: FetchLike,
	request: PreparedRequest,
	options: SendOptions = {}
): Promise<{ response: FetchResponseLike; info: ArcaneHTTPResponseInfo; release: () => void }> {
	throwIfAborted(options.signal);
	const linked = linkSignals(options.signal, options.timeoutMs);
	try {
		const response = await fetchImpl(request.url, {
			method: request.method,
			headers: request.headers,
			body: options.body ?? undefined,
			signal: linked.signal,
			credentials: request.handleCookies ? 'include' : 'omit'
		});
		if (options.timeoutUntilHeaders) linked.clearTimeout();
		return { response, info: responseInfo(response, request.url), release: linked.dispose };
	} catch (error) {
		linked.dispose();
		if (linked.timedOut()) throw new ArcaneTimeoutError();
		if (isAbortError(error) || options.signal?.aborted) throw new CancellationError();
		throw error;
	}
}

export async function readText(
	response: FetchResponseLike,
	signal: AbortSignal | undefined
): Promise<string> {
	try {
		return await response.text();
	} catch (error) {
		if (isAbortError(error) || signal?.aborted) throw new CancellationError();
		throw error;
	}
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new CancellationError());
			return;
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(new CancellationError());
		};
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}
