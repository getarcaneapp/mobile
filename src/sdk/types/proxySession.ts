/** Port of Types/ArcaneProxySession.swift. */

/**
 * An app-owned cookie snapshot. The generation lets the app ignore responses
 * from requests that started before the proxy session was cleared or replaced.
 */
export interface ArcaneProxyRequestContext {
	headers: Record<string, string>;
	generation: number;
	/** False retires an old client before it can send saved proxy headers. Defaults to true. */
	isValid?: boolean;
}

/** Response metadata handed to `ArcaneProxySession.receive` (Swift `HTTPURLResponse`). */
export interface ArcaneHTTPResponseInfo {
	url: string;
	status: number;
	headers: Headers;
}

export interface ArcaneProxySession {
	requestContext(url: string): Promise<ArcaneProxyRequestContext>;
	receive(response: ArcaneHTTPResponseInfo, url: string, generation: number): Promise<void>;
}
