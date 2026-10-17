import type { EnvironmentID } from '../client/environment';
import { q, boolString, type QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import { MessageResponse } from '../models/base/message';
import { SearchPaginationSort, type SortOrder } from '../models/base/pagination';
import {
	NetworkCreateResponse,
	NetworkInspect,
	NetworkPruneReport,
	NetworkSummary,
	type NetworkCreateRequest,
	type NetworkUsageCounts
} from '../models/network/Network';
import type { NetworkTopology } from '../models/network/Topology';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

export class NetworksService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	list(
		args: { envID?: EnvironmentID; query?: SearchPaginationSort; inUse?: boolean } = {}
	): Promise<PaginatedResponse<NetworkSummary>> {
		const query = args.query ?? {};
		const items = SearchPaginationSort.nonPaginationQueryItems(query);
		if (args.inUse !== undefined) items.push(q('inUse', boolString(args.inUse)));
		return this.rest.paginated(this.rest.environmentPath(args.envID, 'networks'), {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: items,
			decode: NetworkSummary.decode
		});
	}

	counts(args: { envID?: EnvironmentID } = {}): Promise<NetworkUsageCounts> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'networks/counts'));
	}

	topology(args: { envID?: EnvironmentID } = {}): Promise<NetworkTopology> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'networks/topology'));
	}

	inspect(args: {
		envID?: EnvironmentID;
		networkID: string;
		sort?: string;
		order?: SortOrder;
	}): Promise<NetworkInspect> {
		const items: QueryItem[] = [];
		if (args.sort !== undefined) items.push(q('sort', args.sort));
		if (args.order !== undefined) items.push(q('order', args.order));
		return this.rest.get(this.rest.environmentPath(args.envID, `networks/${args.networkID}`), {
			query: items,
			decode: NetworkInspect.decode
		});
	}

	create(args: {
		envID?: EnvironmentID;
		request: NetworkCreateRequest;
	}): Promise<NetworkCreateResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'networks'), {
			body: args.request,
			decode: NetworkCreateResponse.decode
		});
	}

	delete(args: { envID?: EnvironmentID; networkID: string }): Promise<MessageResponse> {
		return this.rest.delete(this.rest.environmentPath(args.envID, `networks/${args.networkID}`), {
			decode: MessageResponse.decode
		});
	}

	prune(args: { envID?: EnvironmentID } = {}): Promise<NetworkPruneReport> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'networks/prune'), {
			decode: NetworkPruneReport.decode
		});
	}
}
