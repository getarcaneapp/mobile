import type { User } from '../models/user/User';

export const mobilePushFeature = 'mobile-push-v1';

export type ServerCapabilitiesMode = 'unknown' | 'legacyRoles' | 'rbac';

export interface ServerCapabilities {
	mode: ServerCapabilitiesMode;
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

	supportsMobilePush(caps: ServerCapabilities): boolean {
		return caps.enabledFeatures.has(mobilePushFeature);
	},
	supportsRoleManagement(caps: ServerCapabilities): boolean {
		return caps.mode === 'rbac';
	},
	supportsActivities(caps: ServerCapabilities): boolean {
		return caps.mode === 'rbac';
	},
	supportsPermissionQueries(caps: ServerCapabilities): boolean {
		return caps.mode === 'rbac';
	},

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
