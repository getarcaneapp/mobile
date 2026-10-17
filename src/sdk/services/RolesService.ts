/** Port of Services/RolesService.swift. */
import { q, type QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { SortOrder } from '../models/base/pagination';
import { PermissionsManifest } from '../models/role/PermissionsManifest';
import { Role, type CreateRole, type UpdateRole } from '../models/role/Role';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

/**
 * RolesService manages roles and role-related metadata in v2 RBAC servers.
 * Calls fail with `ArcaneError.notFound` on v1 servers; gate UI on
 * `client.serverCapabilities()` to avoid invoking against v1.
 */
export class RolesService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** List roles (built-in + custom) with pagination. */
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

	/** Get a single role by ID. */
	get(args: { id: string }): Promise<Role> {
		return this.rest.get(`roles/${args.id}`, { decode: Role.decode });
	}

	/** Create a custom role. Reserved for global admins server-side. */
	create(args: { body: CreateRole }): Promise<Role> {
		return this.rest.post('roles', { body: args.body, decode: Role.decode });
	}

	/** Update a custom role. Built-in roles return 403. */
	update(args: { id: string; body: UpdateRole }): Promise<Role> {
		return this.rest.put(`roles/${args.id}`, { body: args.body, decode: Role.decode });
	}

	/**
	 * Delete a custom role. May reject with `.conflict` if removal would leave
	 * the system with zero global admins.
	 */
	delete(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`roles/${args.id}`);
	}

	/**
	 * Returns the server's permission manifest — every recognized
	 * permission grouped by resource. Used to render the permission picker.
	 */
	availablePermissions(): Promise<PermissionsManifest> {
		return this.rest.get('roles/available-permissions', { decode: PermissionsManifest.decode });
	}
}
