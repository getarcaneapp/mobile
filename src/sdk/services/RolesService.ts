import { q, type QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { SortOrder } from '../models/base/pagination';
import { PermissionsManifest } from '../models/role/PermissionsManifest';
import { Role, type CreateRole, type UpdateRole } from '../models/role/Role';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

export class RolesService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	listPaginated(
		args: { search?: string; sort?: string; order?: SortOrder; start?: number; limit?: number } = {}
	): Promise<PaginatedResponse<Role>> {
		const query: QueryItem[] = [];
		if (args.search !== undefined) query.push(q('search', args.search));
		if (args.sort !== undefined) query.push(q('sort', args.sort));
		if (args.order !== undefined) query.push(q('order', args.order));
		return this.rest.transport.paginated('roles', {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query,
			decode: Role.decode
		});
	}

	get(args: { id: string }): Promise<Role> {
		return this.rest.get(`roles/${args.id}`, { decode: Role.decode });
	}

	create(args: { body: CreateRole }): Promise<Role> {
		return this.rest.post('roles', { body: args.body, decode: Role.decode });
	}

	update(args: { id: string; body: UpdateRole }): Promise<Role> {
		return this.rest.put(`roles/${args.id}`, { body: args.body, decode: Role.decode });
	}

	delete(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`roles/${args.id}`);
	}

	availablePermissions(): Promise<PermissionsManifest> {
		return this.rest.get('roles/available-permissions', { decode: PermissionsManifest.decode });
	}
}
