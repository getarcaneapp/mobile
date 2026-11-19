import type { User } from '../models/user/User';

export const mobilePushFeature = 'mobile-push-v1';

export interface ServerCapabilities {
	enabledFeatures: ReadonlySet<string>;
}

export const ServerCapabilities = {
	make(enabledFeatures: Iterable<string> = []): ServerCapabilities {
		return { enabledFeatures: new Set(enabledFeatures) };
	},

	get unknown(): ServerCapabilities {
		return { enabledFeatures: new Set() };
	},

	supportsMobilePush(caps: ServerCapabilities): boolean {
		return caps.enabledFeatures.has(mobilePushFeature);
	},

	isSupportedServer(user: User): boolean {
		return user.permissionsByEnv !== undefined || user.roleAssignments !== undefined;
	},

	equals(a: ServerCapabilities, b: ServerCapabilities): boolean {
		if (a.enabledFeatures.size !== b.enabledFeatures.size) return false;
		for (const feature of a.enabledFeatures) if (!b.enabledFeatures.has(feature)) return false;
		return true;
	}
};
