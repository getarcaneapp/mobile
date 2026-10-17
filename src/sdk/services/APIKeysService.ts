/** Port of Services/APIKeysService.swift. */
import { q, type QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { APIKey, APIKeyCreated, CreateAPIKey, UpdateAPIKey } from '../models/apiKey/APIKey';
import type { SortOrder } from '../models/base/pagination';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

/** APIKeysService manages API keys for programmatic access. */
export class APIKeysService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** List API keys with pagination. */
	listPaginated(
		args: { search?: string; sort?: string; order?: SortOrder; start?: number; limit?: number } = {}
	): Promise<PaginatedResponse<APIKey>> {
		const query: QueryItem[] = [];
		if (args.search !== undefined) query.push(q('search', args.search));
		if (args.sort !== undefined) query.push(q('sort', args.sort));
		if (args.order !== undefined) query.push(q('order', args.order));
		return this.rest.transport.paginated('api-keys', {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query
		});
	}

	/** Get details of a specific API key. */
	get(args: { id: string }): Promise<APIKey> {
		return this.rest.get(`api-keys/${args.id}`);
	}

	/** Create a new API key. The plain-text key is returned only on creation. */
	create(args: { body: CreateAPIKey }): Promise<APIKeyCreated> {
		return this.rest.post('api-keys', { body: args.body });
	}

	/** Update an existing API key. */
	update(args: { id: string; body: UpdateAPIKey }): Promise<APIKey> {
		return this.rest.put(`api-keys/${args.id}`, { body: args.body });
	}

	/** Delete an API key. */
	delete(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`api-keys/${args.id}`);
	}
}
