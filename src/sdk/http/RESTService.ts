import type { ArcaneTransport } from '../client/ArcaneTransport';
import type { EnvironmentID } from '../client/environment';
import type { QueryItem } from '../client/url';
import { MessageResponse } from '../models/base/message';
import type { Decoder } from '../models/base/decoding';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';
import type { ArcaneRequestOptions } from './requestOptions';

export interface RESTInit<T> {
	query?: QueryItem[];
	options?: ArcaneRequestOptions;
	decode?: Decoder<T>;
}

export interface RESTBodyInit<T> extends RESTInit<T> {
	body?: unknown;
}

export class RESTService {
	readonly transport: ArcaneTransport;
	readonly defaultEnvironmentID: EnvironmentID;

	constructor(transport: ArcaneTransport, defaultEnvironmentID: EnvironmentID) {
		this.transport = transport;
		this.defaultEnvironmentID = defaultEnvironmentID;
	}

	get<T>(path: string, init: RESTInit<T> = {}): Promise<T> {
		return this.transport.request<T>(path, {
			query: init.query,
			options: init.options,
			decode: init.decode
		});
	}

	post<T>(path: string, init: RESTBodyInit<T> = {}): Promise<T> {
		return this.transport.request<T>(path, { method: 'POST', ...init });
	}

	put<T>(path: string, init: RESTBodyInit<T> = {}): Promise<T> {
		return this.transport.request<T>(path, { method: 'PUT', ...init });
	}

	patch<T>(path: string, init: RESTBodyInit<T> = {}): Promise<T> {
		return this.transport.request<T>(path, { method: 'PATCH', ...init });
	}

	delete<T>(path: string, init: RESTInit<T> = {}): Promise<T> {
		return this.transport.request<T>(path, { method: 'DELETE', ...init });
	}

	async deleteVoid(path: string, init: Omit<RESTInit<never>, 'decode'> = {}): Promise<void> {
		await this.transport.request(path, {
			method: 'DELETE',
			...init,
			decode: MessageResponse.decode
		});
	}

	async postVoid(path: string, init: Omit<RESTBodyInit<never>, 'decode'> = {}): Promise<void> {
		await this.transport.request(path, { method: 'POST', ...init, decode: MessageResponse.decode });
	}

	async putVoid(path: string, init: Omit<RESTBodyInit<never>, 'decode'> = {}): Promise<void> {
		await this.transport.request(path, { method: 'PUT', ...init, decode: MessageResponse.decode });
	}

	paginated<T>(
		path: string,
		init: { start: number; limit: number } & RESTInit<T>
	): Promise<PaginatedResponse<T>> {
		return this.transport.paginated<T>(path, init);
	}

	async requestPayload<T>(
		path: string,
		init: { method?: string; body?: unknown; query?: QueryItem[]; decode?: Decoder<T> } = {}
	): Promise<T> {
		const text = await this.transport.rawRequest(path, {
			method: init.method ?? 'POST',
			query: init.query,
			body: init.body
		});
		try {
			return this.transport.decodeEnvelope(text, init.decode);
		} catch {
			return this.transport.decode(text, init.decode);
		}
	}

	environmentPath(envID: EnvironmentID | undefined, suffix: string): string {
		return `environments/${envID ?? this.defaultEnvironmentID}/${suffix.replace(/^\/+/, '').replace(/\/+$/, '')}`;
	}
}
