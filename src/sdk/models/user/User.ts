/** Port of Models/User/User.swift. */
import { D } from '../base/decoding';
import { Permission } from '../role/Permission';
import { Role } from '../role/Role';
import type { RoleAssignmentSummary } from '../role/RoleAssignment';

/**
 * Per-user display/UI preferences. Every field is optional so unset values
 * fall back to frontend defaults. Mirrors `types/user.Preferences`.
 */
export interface UserPreferences {
	themeMode?: string;
	applicationTheme?: string;
	accentColor?: string;
	iconCatalog?: string;
	oledMode?: boolean;
	glassEffectsEnabled?: boolean;
	animationsEnabled?: boolean;
	sidebarHoverExpansion?: boolean;
	keyboardShortcutsEnabled?: boolean;
	mobileNavigationMode?: string;
	mobileNavigationShowLabels?: boolean;
	defaultLandingPage?: string;
	defaultProjectEditorLayout?: string;
}

export interface User {
	id: string;
	username: string;
	displayName?: string;
	email?: string;
	/**
	 * Legacy string-role list. On a v1 server this is the source of truth.
	 * On a v2 server (where `roleAssignments` is populated) this is
	 * synthesized as the deduped list of role IDs from `roleAssignments`.
	 */
	roles: string[];
	canDelete: boolean;
	oidcSubjectId?: string;
	locale?: string;
	createdAt?: string;
	updatedAt?: string;
	requiresPasswordChange: boolean;
	/** Role assignments held by the user. `undefined` on a v1 server. */
	roleAssignments?: RoleAssignmentSummary[];
	/**
	 * Effective permissions keyed by environment ID. The reserved key
	 * `"global"` holds permissions that apply across every environment and
	 * to org-level endpoints. `undefined` on a v1 server.
	 */
	permissionsByEnv?: Record<string, string[]>;
	/** Backend-authoritative administrator classification (JSON key `isGlobalAdmin`). */
	serverIsGlobalAdmin?: boolean;
	/** Personal display/UI preferences. Undefined on older servers. */
	preferences?: UserPreferences;
}

function decodeRoleAssignmentSummary(raw: unknown): RoleAssignmentSummary {
	const o = D.object(raw, 'RoleAssignmentSummary');
	return {
		roleId: D.string(o, 'roleId'),
		environmentId: D.optString(o, 'environmentId'),
		source: D.string(o, 'source')
	};
}

export const User = {
	/** Swift `User.init(from:)`: v1/v2 tolerant decoding. */
	decode(this: void, raw: unknown): User {
		const o = D.object(raw, 'User');
		const decodedRoles = D.optArray(o, 'roles', D.str);
		const decodedAssignments = D.optArray(o, 'roleAssignments', decodeRoleAssignmentSummary);
		const decodedPerms = D.optRecord(o, 'permissionsByEnv', (value) =>
			D.array({ value }, 'value', D.str)
		);
		let roles: string[];
		if (decodedRoles) {
			roles = decodedRoles;
		} else if (decodedAssignments) {
			const seen = new Set<string>();
			roles = [];
			for (const assignment of decodedAssignments) {
				if (!seen.has(assignment.roleId)) {
					seen.add(assignment.roleId);
					roles.push(assignment.roleId);
				}
			}
		} else {
			roles = [];
		}
		return {
			id: D.string(o, 'id'),
			username: D.string(o, 'username'),
			displayName: D.optString(o, 'displayName'),
			email: D.optString(o, 'email'),
			roles,
			canDelete: D.optBoolean(o, 'canDelete') ?? false,
			oidcSubjectId: D.optString(o, 'oidcSubjectId'),
			locale: D.optString(o, 'locale'),
			createdAt: D.optString(o, 'createdAt'),
			updatedAt: D.optString(o, 'updatedAt'),
			requiresPasswordChange: D.optBoolean(o, 'requiresPasswordChange') ?? false,
			roleAssignments: decodedAssignments,
			permissionsByEnv: decodedPerms,
			serverIsGlobalAdmin: D.optBoolean(o, 'isGlobalAdmin'),
			preferences: D.optNested(o, 'preferences', D.cast<UserPreferences>)
		};
	},

	/** Swift synthesized `encode(to:)` (`serverIsGlobalAdmin` → `isGlobalAdmin`). */
	encode(this: void, user: User): Record<string, unknown> {
		const { serverIsGlobalAdmin, ...rest } = user;
		return { ...rest, isGlobalAdmin: serverIsGlobalAdmin };
	},

	// MARK: - User+Permissions.swift

	/**
	 * Reserved key in `permissionsByEnv` that holds permissions applying
	 * across every environment and to org-level endpoints.
	 */
	globalPermissionsKey: 'global',

	/**
	 * True iff this user holds a global `role_admin` assignment (v2), has
	 * the sudo wildcard `"*"` in their global permissions (v2), or has
	 * `"admin"` in the legacy `roles` array (v1). The server's
	 * `isGlobalAdmin` classification wins when present.
	 */
	isGlobalAdmin(this: void, user: User): boolean {
		if (user.serverIsGlobalAdmin !== undefined) return user.serverIsGlobalAdmin;
		if (user.roleAssignments !== undefined) {
			const adminGlobally = user.roleAssignments.some(
				(assignment) =>
					assignment.roleId === Role.BuiltIn.admin && assignment.environmentId === undefined
			);
			if (adminGlobally) return true;
		}
		if (user.permissionsByEnv?.[User.globalPermissionsKey]?.includes(Permission.sudo)) {
			return true;
		}
		return user.roles.includes('admin');
	},

	/** Backward-compat alias for `isGlobalAdmin`. */
	isAdmin(this: void, user: User): boolean {
		return User.isGlobalAdmin(user);
	},

	/**
	 * All permissions the user effectively holds for the given environment.
	 * Pass `undefined` for "global / org-level only".
	 *
	 * - v2: union of `permissionsByEnv["global"]` and (if envID is set)
	 *   `permissionsByEnv[envID]`.
	 * - v1: admins receive `[Permission.sudo]`; non-admins an empty set.
	 */
	permissions(this: void, user: User, envID?: string): Set<string> {
		const perms = user.permissionsByEnv;
		if (perms !== undefined) {
			const out = new Set(perms[User.globalPermissionsKey] ?? []);
			if (envID !== undefined) {
				for (const permission of perms[envID] ?? []) out.add(permission);
			}
			return out;
		}
		return User.isGlobalAdmin(user) ? new Set([Permission.sudo]) : new Set();
	},

	/**
	 * Whether the user holds `perm` for the given environment. Omit
	 * `environmentID` to check only the global bucket. Always true when an
	 * in-scope bucket contains the sudo wildcard `"*"`.
	 */
	hasPermission(this: void, user: User, perm: string, environmentID?: string): boolean {
		const bucket = User.permissions(user, environmentID);
		if (bucket.has(Permission.sudo)) return true;
		return bucket.has(perm);
	},

	/** Whether the user holds any of `perms` for the given environment. */
	hasAnyPermission(this: void, user: User, perms: string[], environmentID?: string): boolean {
		const bucket = User.permissions(user, environmentID);
		if (bucket.has(Permission.sudo)) return true;
		return perms.some((perm) => bucket.has(perm));
	}
} as const;

export interface CreateUser {
	username: string;
	password: string;
	displayName?: string;
	email?: string;
	/**
	 * Initial role assignments by name.
	 * - v1 servers: included on the wire and applied (`["admin"]`, `["user"]`).
	 * - v2 (RBAC) servers: must be undefined. Use
	 *   `client.users.setRoleAssignments({ userId, assignments })` after create.
	 */
	roles?: string[];
	locale?: string;
}

export interface UpdateUser {
	username?: string;
	displayName?: string;
	email?: string;
	/**
	 * Role list update.
	 * - v1 servers: included on the wire and applied.
	 * - v2 (RBAC) servers: must be undefined. Use `setRoleAssignments` instead.
	 */
	roles?: string[];
	locale?: string;
	password?: string;
}
