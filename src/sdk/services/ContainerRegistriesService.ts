import { q, type QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { SortOrder } from '../models/base/pagination';
import {
	ContainerRegistry,
	ContainerRegistrySyncRequest,
	type ContainerRegistryPullUsageResponse,
	type CreateContainerRegistry,
	type UpdateContainerRegistry
} from '../models/containerRegistry/ContainerRegistry';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

export class ContainerRegistriesService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	listPaginated(
		args: { search?: string; sort?: string; order?: SortOrder; start?: number; limit?: number } = {}
	): Promise<PaginatedResponse<ContainerRegistry>> {
		const query: QueryItem[] = [];
		if (args.search !== undefined) query.push(q('search', args.search));
		if (args.sort !== undefined) query.push(q('sort', args.sort));
		if (args.order !== undefined) query.push(q('order', args.order));
		return this.rest.transport.paginated('container-registries', {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query,
			decode: ContainerRegistry.decode
		});
	}

	get(args: { id: string }): Promise<ContainerRegistry> {
		return this.rest.get(`container-registries/${args.id}`, { decode: ContainerRegistry.decode });
	}

	create(args: { body: CreateContainerRegistry }): Promise<ContainerRegistry> {
		return this.rest.post('container-registries', {
			body: args.body,
			decode: ContainerRegistry.decode
		});
	}

	update(args: { id: string; body: UpdateContainerRegistry }): Promise<ContainerRegistry> {
		return this.rest.put(`container-registries/${args.id}`, {
			body: args.body,
			decode: ContainerRegistry.decode
		});
	}

	delete(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`container-registries/${args.id}`);
	}

	test(args: { id: string }): Promise<void> {
		return this.rest.postVoid(`container-registries/${args.id}/test`);
	}

	sync(args: { body: ContainerRegistrySyncRequest }): Promise<void> {
		return this.rest.postVoid('container-registries/sync', {
			body: ContainerRegistrySyncRequest.encode(args.body)
		});
	}

	pullUsage(): Promise<ContainerRegistryPullUsageResponse> {
		return this.rest.get('container-registries/pull-usage');
	}
}
