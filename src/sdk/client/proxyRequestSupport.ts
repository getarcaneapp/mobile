/**
 * Port of Client/ProxyRequestSupport.swift.
 *
 * Differences from Swift (platform limits, see README):
 * - `fetch` follows redirects itself, so instead of vetoing each hop in a
 *   URLSession delegate, the final `response.url` is checked with `contains`
 *   and any 3xx that surfaces is treated as a proxy gate.
 * - WebSocket handshake responses are not observable from JS, so
 *   `receive` is only invoked for HTTP responses.
 */
import { ArcaneError, CancellationError } from '../errors/ArcaneError';
import type {
	ArcaneHTTPResponseInfo,
	ArcaneProxyRequestContext,
	ArcaneProxySession
} from '../types/proxySession';
import { parseURL } from './url';

const TOKEN_CHARS = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const BLOCKED_HEADERS = new Set([
	'authorization',
	'x-api-key',
	'x-step-up-token',
	'cookie',
	'host',
	'content-length',
	'connection',
	'upgrade',
	'transfer-encoding',
	'te',
	'trailer',
	'proxy-connection'
]);

function hasLineBreak(value: string): boolean {
	return value.includes('\r') || value.includes('\n');
}

/** Mutable request under construction (Swift `URLRequest`). */
export interface PreparedRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
	/** `false` mirrors `httpShouldHandleCookies = false`. */
	handleCookies: boolean;
}

export function setHeader(headers: Record<string, string>, name: string, value: string): void {
	const lower = name.toLowerCase();
	for (const key of Object.keys(headers)) {
		if (key.toLowerCase() === lower && key !== name) delete headers[key];
	}
	headers[name] = value;
}

export function getHeader(headers: Record<string, string>, name: string): string | undefined {
	const lower = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === lower) return value;
	}
	return undefined;
}

/** Records the proxy context so the response can be reported (Swift `ProxyRequestDelegate`). */
export class ProxyRequestDelegate {
	readonly support: ProxyRequestSupport;
	private readonly context: ArcaneProxyRequestContext | undefined;
	private readonly url: string;

	constructor(
		support: ProxyRequestSupport,
		context: ArcaneProxyRequestContext | undefined,
		url: string
	) {
		this.support = support;
		this.context = context;
		this.url = url;
	}

	async receive(response: ArcaneHTTPResponseInfo): Promise<void> {
		const context = this.context;
		if (context && this.support.contains(response.url || this.url)) {
			await this.support.session?.receive(response, this.url, context.generation);
		}
	}
}

export class ProxyRequestSupport {
	readonly baseURL: string;
	readonly additionalHeaders: Record<string, string>;
	readonly session: ArcaneProxySession | undefined;

	constructor(
		baseURL: string,
		additionalHeaders: Record<string, string> = {},
		session?: ArcaneProxySession
	) {
		this.baseURL = baseURL;
		this.additionalHeaders = additionalHeaders;
		this.session = session;
	}

	async prepare(request: PreparedRequest): Promise<ProxyRequestDelegate> {
		if (!this.contains(request.url)) throw ArcaneError.proxyAuthenticationRequired();
		for (const [name, value] of Object.entries(this.additionalHeaders)) {
			if (ProxyRequestSupport.isAllowed(name, value)) setHeader(request.headers, name, value);
		}
		if (this.session) request.handleCookies = false;
		const context = await this.session?.requestContext(request.url);
		if (context && context.isValid === false) throw new CancellationError();
		for (const [name, value] of Object.entries(context?.headers ?? {})) {
			if (name.toLowerCase() === 'cookie' && !hasLineBreak(value)) {
				setHeader(request.headers, name, value);
			}
		}
		return new ProxyRequestDelegate(this, context, request.url);
	}

	contains(url: string): boolean {
		const target = parseURL(url);
		const base = parseURL(this.baseURL);
		if (!target || !base) return false;
		const scheme = (value: string) => (value === 'wss' ? 'https' : value === 'ws' ? 'http' : value);
		const port = (parsed: { scheme: string; port?: number }) =>
			parsed.port ?? (scheme(parsed.scheme) === 'https' ? 443 : 80);
		if (
			scheme(target.scheme) !== scheme(base.scheme) ||
			target.host.toLowerCase() !== base.host.toLowerCase() ||
			port(target) !== port(base)
		) {
			return false;
		}
		if (target.user !== undefined || target.password !== undefined) return false;
		const segments = target.path.split('/').map((part) => {
			try {
				return decodeURIComponent(part);
			} catch {
				return part;
			}
		});
		if (segments.some((part) => part === '.' || part === '..')) return false;
		const basePath = base.path.replace(/^\/+/, '').replace(/\/+$/, '');
		const targetPath = target.path.length > 1 ? target.path.replace(/\/+$/, '') : target.path;
		return (
			basePath === '' || targetPath === `/${basePath}` || target.path.startsWith(`/${basePath}/`)
		);
	}

	static isAllowed(name: string, value: string): boolean {
		const lower = name.toLowerCase();
		return (
			name !== '' &&
			TOKEN_CHARS.test(name) &&
			!hasLineBreak(value) &&
			!BLOCKED_HEADERS.has(lower) &&
			!lower.startsWith('x-arcane-')
		);
	}

	/**
	 * Throws `proxyAuthenticationRequired` for HTML gates, redirects, 407s and
	 * `Proxy-Authenticate`; `authenticationRejected` for 401/403 bodies that are
	 * not Arcane (or RFC 7807) errors, so they never invalidate Arcane tokens.
	 */
	check(response: ArcaneHTTPResponseInfo, body?: string, expectsJSON = true): void {
		if (!response.url || !this.contains(response.url)) {
			throw ArcaneError.proxyAuthenticationRequired();
		}
		const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? '';
		const html = contentType.includes('text/html');
		const prefix = body?.slice(0, 512).trim().toLowerCase();
		const htmlBody =
			prefix?.startsWith('<!doctype html') === true || prefix?.startsWith('<html') === true;
		const status = response.status;
		const successful = status >= 200 && status < 300;
		if (
			((html || htmlBody) && ((successful && expectsJSON) || [401, 403, 407].includes(status))) ||
			(status >= 300 && status < 400) ||
			status === 407 ||
			response.headers.get('Proxy-Authenticate') !== null
		) {
			throw ArcaneError.proxyAuthenticationRequired();
		}
		if ((status === 401 || status === 403) && body !== undefined) {
			let json: unknown;
			try {
				json = JSON.parse(body);
			} catch {
				json = undefined;
			}
			const object =
				typeof json === 'object' && json !== null && !Array.isArray(json)
					? (json as Record<string, unknown>)
					: undefined;
			const isArcane = object?.success === false;
			const isProblem = object?.status === status && typeof object?.title === 'string';
			if (!isArcane && !isProblem) throw ArcaneError.authenticationRejected();
		}
	}
}
