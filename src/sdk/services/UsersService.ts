/** Port of Services/UsersService.swift. */
import { q, type QueryItem } from '../client/url';
import { isArcaneError } from '../errors/ArcaneError';
import type { RESTService } from '../http/RESTService';
import type { PasswordChange } from '../models/auth/Login';
import type { SortOrder } from '../models/base/pagination';
import type { RoleAssignment, UserAssignmentInput } from '../models/role/RoleAssignment';
import { User, type CreateUser, type UpdateUser } from '../models/user/User';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

/** UsersService manages user accounts and password changes. */
export class UsersService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** List users with pagination. */
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

	/** Get a user by ID. */
	get(args: { id: string }): Promise<User> {
		return this.rest.get(`users/${args.id}`, { decode: User.decode });
	}

	/** Create a new user account. */
	create(args: { body: CreateUser }): Promise<User> {
		return this.rest.post('users', { body: args.body, decode: User.decode });
	}

	/** Update an existing user. */
	update(args: { id: string; body: UpdateUser }): Promise<User> {
		return this.rest.put(`users/${args.id}`, { body: args.body, decode: User.decode });
	}

	/** Delete a user. */
	delete(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`users/${args.id}`);
	}

	/**
	 * Fetch a user's custom profile picture as raw image bytes.
	 * Returns `undefined` when the user has no custom avatar (the server 404s).
	 */
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

	/** Change the current user's password. */
	changePassword(args: { body: PasswordChange }): Promise<void> {
		return this.rest.postVoid('auth/password', { body: args.body });
	}

	/** List a user's role assignments (v2 only). Reserved for global admins server-side. */
	getRoleAssignments(args: { userId: string }): Promise<RoleAssignment[]> {
		return this.rest.get(`users/${args.userId}/role-assignments`);
	}

	/**
	 * Replace a user's manual role assignments (v2 only).
	 * `source == "oidc"` assignments are preserved by the server.
	 * May reject with `.conflict` if the change would remove the last global admin.
	 */
	setRoleAssignments(args: {
		userId: string;
		assignments: UserAssignmentInput[];
	}): Promise<RoleAssignment[]> {
		return this.rest.put(`users/${args.userId}/role-assignments`, {
			body: { assignments: args.assignments }
		});
	}
}
