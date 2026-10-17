/** Port of Services/PortsService.swift. */
import type { EnvironmentID } from '../client/environment';
import type { RESTService } from '../http/RESTService';
import { SearchPaginationSort } from '../models/base/pagination';
import { PortMapping } from '../models/port/PortMapping';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

export class PortsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** Paginated list of port mappings across containers in an environment. */
	list(
		args: { envID?: EnvironmentID; query?: SearchPaginationSort } = {}
	): Promise<PaginatedResponse<PortMapping>> {
		const query = args.query ?? {};
		return this.rest.paginated(this.rest.environmentPath(args.envID, 'ports'), {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: SearchPaginationSort.nonPaginationQueryItems(query),
			decode: PortMapping.decode
		});
	}
}
