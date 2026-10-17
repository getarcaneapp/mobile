/** Port of Services/ContainerRegistriesService.swift. */
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

/** ContainerRegistriesService manages container image registry configurations. */
export class ContainerRegistriesService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** List container registries with pagination. */
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

	/** Get a container registry by ID. */
	get(args: { id: string }): Promise<ContainerRegistry> {
		return this.rest.get(`container-registries/${args.id}`, { decode: ContainerRegistry.decode });
	}

	/** Create a new container registry. */
	create(args: { body: CreateContainerRegistry }): Promise<ContainerRegistry> {
		return this.rest.post('container-registries', {
			body: args.body,
			decode: ContainerRegistry.decode
		});
	}

	/** Update an existing container registry. */
	update(args: { id: string; body: UpdateContainerRegistry }): Promise<ContainerRegistry> {
		return this.rest.put(`container-registries/${args.id}`, {
			body: args.body,
			decode: ContainerRegistry.decode
		});
	}

	/** Delete a container registry. */
	delete(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`container-registries/${args.id}`);
	}

	/** Test connectivity and authentication for a container registry. */
	test(args: { id: string }): Promise<void> {
		return this.rest.postVoid(`container-registries/${args.id}/test`);
	}

	/** Sync container registries from a remote source (manager to agent). */
	sync(args: { body: ContainerRegistrySyncRequest }): Promise<void> {
		return this.rest.postVoid('container-registries/sync', {
			body: ContainerRegistrySyncRequest.encode(args.body)
		});
	}

	/** Get pull-usage and rate-limit visibility for configured registries. */
	pullUsage(): Promise<ContainerRegistryPullUsageResponse> {
		return this.rest.get('container-registries/pull-usage');
	}
}
