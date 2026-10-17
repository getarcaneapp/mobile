import { D } from '../base/decoding';
import { Permission } from '../role/Permission';
import { Role } from '../role/Role';
import type { RoleAssignmentSummary } from '../role/RoleAssignment';

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
	roles: string[];
	canDelete: boolean;
	oidcSubjectId?: string;
	locale?: string;
	createdAt?: string;
	updatedAt?: string;
	requiresPasswordChange: boolean;
	roleAssignments?: RoleAssignmentSummary[];
	permissionsByEnv?: Record<string, string[]>;
	serverIsGlobalAdmin?: boolean;
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

	encode(this: void, user: User): Record<string, unknown> {
		const { serverIsGlobalAdmin, ...rest } = user;
		return { ...rest, isGlobalAdmin: serverIsGlobalAdmin };
	},

	globalPermissionsKey: 'global',

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

	isAdmin(this: void, user: User): boolean {
		return User.isGlobalAdmin(user);
	},

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

	hasPermission(this: void, user: User, perm: string, environmentID?: string): boolean {
		const bucket = User.permissions(user, environmentID);
		if (bucket.has(Permission.sudo)) return true;
		return bucket.has(perm);
	},

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
	roles?: string[];
	locale?: string;
}

export interface UpdateUser {
	username?: string;
	displayName?: string;
	email?: string;
	roles?: string[];
	locale?: string;
	password?: string;
}
