export interface ArcaneProxyRequestContext {
	headers: Record<string, string>;
	generation: number;
	isValid?: boolean;
}

export interface ArcaneHTTPResponseInfo {
	url: string;
	status: number;
	headers: Headers;
}

export interface ArcaneProxySession {
	requestContext(url: string): Promise<ArcaneProxyRequestContext>;
	receive(response: ArcaneHTTPResponseInfo, url: string, generation: number): Promise<void>;
}
