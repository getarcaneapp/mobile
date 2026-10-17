import { q, type QueryItem } from '../client/url';
import { isArcaneError } from '../errors/ArcaneError';
import type { RESTService } from '../http/RESTService';
import type { PasswordChange } from '../models/auth/Login';
import type { SortOrder } from '../models/base/pagination';
import type { RoleAssignment, UserAssignmentInput } from '../models/role/RoleAssignment';
import { User, type CreateUser, type UpdateUser } from '../models/user/User';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

export class UsersService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	listPaginated(
		args: { search?: string; sort?: string; order?: SortOrder; start?: number; limit?: number } = {}
	): Promise<PaginatedResponse<User>> {
		const query: QueryItem[] = [];
		if (args.search !== undefined) query.push(q('search', args.search));
		if (args.sort !== undefined) query.push(q('sort', args.sort));
		if (args.order !== undefined) query.push(q('order', args.order));
		return this.rest.transport.paginated('users', {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query,
			decode: User.decode
		});
	}

	get(args: { id: string }): Promise<User> {
		return this.rest.get(`users/${args.id}`, { decode: User.decode });
	}

	create(args: { body: CreateUser }): Promise<User> {
		return this.rest.post('users', { body: args.body, decode: User.decode });
	}

	update(args: { id: string; body: UpdateUser }): Promise<User> {
		return this.rest.put(`users/${args.id}`, { body: args.body, decode: User.decode });
	}

	delete(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`users/${args.id}`);
	}

	async getAvatar(args: { userId: string }): Promise<Uint8Array | undefined> {
		try {
			return await this.rest.transport.rawDataRequest(`users/${args.userId}/avatar`, {
				method: 'GET'
			});
		} catch (error) {
			if (isArcaneError(error, 'notFound')) return undefined;
			throw error;
		}
	}

	changePassword(args: { body: PasswordChange }): Promise<void> {
		return this.rest.postVoid('auth/password', { body: args.body });
	}

	getRoleAssignments(args: { userId: string }): Promise<RoleAssignment[]> {
		return this.rest.get(`users/${args.userId}/role-assignments`);
	}

	setRoleAssignments(args: {
		userId: string;
		assignments: UserAssignmentInput[];
	}): Promise<RoleAssignment[]> {
		return this.rest.put(`users/${args.userId}/role-assignments`, {
			body: { assignments: args.assignments }
		});
	}
}
