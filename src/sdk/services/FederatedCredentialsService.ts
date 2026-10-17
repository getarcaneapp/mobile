import type { RESTService } from '../http/RESTService';
import { SearchPaginationSort } from '../models/base/pagination';
import type {
	CreateFederatedCredential,
	FederatedCredential,
	UpdateFederatedCredential
} from '../models/federated/FederatedCredential';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

export class FederatedCredentialsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	list(
		args: { query?: SearchPaginationSort } = {}
	): Promise<PaginatedResponse<FederatedCredential>> {
		const query = args.query ?? {};
		return this.rest.transport.paginated('federated-credentials', {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: SearchPaginationSort.nonPaginationQueryItems(query)
		});
	}

	get(args: { id: string }): Promise<FederatedCredential> {
		return this.rest.get(`federated-credentials/${args.id}`);
	}

	create(args: { body: CreateFederatedCredential }): Promise<FederatedCredential> {
		return this.rest.post('federated-credentials', { body: args.body });
	}

	update(args: { id: string; body: UpdateFederatedCredential }): Promise<FederatedCredential> {
		return this.rest.put(`federated-credentials/${args.id}`, { body: args.body });
	}

	delete(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`federated-credentials/${args.id}`);
	}
}
