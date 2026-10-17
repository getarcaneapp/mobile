/**
 * Low-level `fetch` plumbing: timeouts, cancellation and response metadata.
 * Swift relies on `URLSession` timeouts and structured task cancellation;
 * here every request takes an optional `AbortSignal` plus a timeout.
 */
import { ArcaneTimeoutError, CancellationError, isAbortError } from '../errors/ArcaneError';
import type { ArcaneHTTPResponseInfo } from '../types/proxySession';
import type { PreparedRequest } from '../client/proxyRequestSupport';

/** Minimal response surface used by the SDK (satisfied by global and expo `fetch`). */
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

/** Default request timeout (URLSession `timeoutIntervalForRequest` default is 60s). */
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Links an optional caller signal with a timeout. `timedOut()` tells a
 * timeout apart from caller cancellation. Call `dispose()` when done.
 */
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
		/** Stops the timeout (e.g. once a streaming response has started). */
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

/** Throws `CancellationError` if `signal` is aborted. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
	if (signal?.aborted) throw new CancellationError();
}

export interface SendOptions {
	body?: FetchInitLike['body'];
	signal?: AbortSignal;
	timeoutMs?: number;
	/** Keep the timeout running only until headers arrive (streaming). */
	timeoutUntilHeaders?: boolean;
}

/**
 * Sends a prepared request. Abort → `CancellationError`, timeout →
 * `ArcaneTimeoutError`, network failure → the platform `TypeError`.
 */
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

/** Reads the body as text, mapping abort/timeout like `send`. */
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
