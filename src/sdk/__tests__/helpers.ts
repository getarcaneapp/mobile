import type { FetchInitLike, FetchLike, FetchResponseLike } from '../http/fetching';

export interface RecordedRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
	body: unknown;
}

export interface MockReply {
	status: number;
	body: unknown;
	headers?: Record<string, string>;
	delayMs?: number;
}

export function jsonResponse(url: string, reply: MockReply): FetchResponseLike {
	const text = typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body);
	const bytes = new TextEncoder().encode(text);
	return {
		status: reply.status,
		url,
		headers: new Headers({ 'Content-Type': 'application/json', ...reply.headers }),
		body: null,
		text: async () => text,
		arrayBuffer: async () =>
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
	};
}

export function mockFetch(handler: (request: RecordedRequest) => MockReply | Promise<MockReply>) {
	const requests: RecordedRequest[] = [];
	const fetch: FetchLike = async (url: string, init?: FetchInitLike) => {
		const request: RecordedRequest = {
			url,
			method: init?.method ?? 'GET',
			headers: { ...init?.headers },
			body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
		};
		requests.push(request);
		const reply = await handler(request);
		if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
		return jsonResponse(url, reply);
	};
	return { fetch, requests };
}

export function isoIn(seconds: number): string {
	return new Date(Date.now() + seconds * 1000).toISOString();
}
