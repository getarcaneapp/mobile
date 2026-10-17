/** Port of Client/ServerCapabilities.swift. */
import type { User } from '../models/user/User';

/** Swift `mobilePushFeature` (Models/MobilePush/MobilePush.swift). */
export const mobilePushFeature = 'mobile-push-v1';

export type ServerCapabilitiesMode =
	/** Detection has not yet happened (no user payload has been decoded). */
	| 'unknown'
	/** Legacy string-roles backend. `User.roles` is the source of truth. */
	| 'legacyRoles'
	/** RBAC backend with role assignments + per-env permission sets. */
	| 'rbac';

/**
 * Snapshot of which Arcane API shape the server speaks. Populated from the
 * first authenticated `User` payload the SDK decodes (login, `auth/me`, or
 * any OIDC callback). Swift computed properties are companion functions:
 * `caps.supportsActivities` → `ServerCapabilities.supportsActivities(caps)`.
 */
export interface ServerCapabilities {
	mode: ServerCapabilitiesMode;
	/** Feature flags advertised by `/app-version` `enabledFeatures` (lowercased). */
	enabledFeatures: ReadonlySet<string>;
}

export const ServerCapabilities = {
	Mode: { unknown: 'unknown', legacyRoles: 'legacyRoles', rbac: 'rbac' } as const,

	make(mode: ServerCapabilitiesMode, enabledFeatures: Iterable<string> = []): ServerCapabilities {
		return { mode, enabledFeatures: new Set(enabledFeatures) };
	},

	get unknown(): ServerCapabilities {
		return { mode: 'unknown', enabledFeatures: new Set() };
	},

	/** True iff the server advertises `mobile-push-v1` (the `/apns` endpoints). */
	supportsMobilePush(caps: ServerCapabilities): boolean {
		return caps.enabledFeatures.has(mobilePushFeature);
	},
	/** True iff the server exposes the v2 RBAC endpoints. */
	supportsRoleManagement(caps: ServerCapabilities): boolean {
		return caps.mode === 'rbac';
	},
	/** True iff the server exposes the v2 background activity endpoints. */
	supportsActivities(caps: ServerCapabilities): boolean {
		return caps.mode === 'rbac';
	},
	/** True iff payloads include `permissionsByEnv`. */
	supportsPermissionQueries(caps: ServerCapabilities): boolean {
		return caps.mode === 'rbac';
	},

	/** `permissionsByEnv` is the canonical v2 signal; `roleAssignments` is a fallback. */
	detect(user: User): ServerCapabilitiesMode {
		if (user.permissionsByEnv !== undefined || user.roleAssignments !== undefined) return 'rbac';
		return 'legacyRoles';
	},

	equals(a: ServerCapabilities, b: ServerCapabilities): boolean {
		if (a.mode !== b.mode || a.enabledFeatures.size !== b.enabledFeatures.size) return false;
		for (const feature of a.enabledFeatures) if (!b.enabledFeatures.has(feature)) return false;
		return true;
	}
};
