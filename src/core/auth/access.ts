import {
	accessSurfaceIDs,
	isEnvironmentScoped,
	requiresAdmin,
	requiresV2,
	type AppTab
} from '@/core/app-tab';
import type { ServerCapabilities } from '@/sdk/client/ServerCapabilities';
import { PermissionsManifest } from '@/sdk/models/role/PermissionsManifest';
import type { PublicSetting } from '@/sdk/models/settings/Settings';
import { User } from '@/sdk/models/user/User';

export interface LoginCapabilities {
	localAuthEnabled: boolean;
	oidcEnabled: boolean;
	oidcProviderName: string;
	oidcProviderLogoURL: string;
}

export const LoginCapabilities = {
	fromPublicSettings(publicSettings: readonly PublicSetting[]): LoginCapabilities {
		const values = new Map<string, string>();
		for (const setting of publicSettings) values.set(setting.key, setting.value);
		const localAuthValue = values.get('authLocalEnabled')?.trim().toLowerCase();
		return {
			localAuthEnabled: localAuthValue !== 'false',
			oidcEnabled: values.get('oidcEnabled')?.trim().toLowerCase() === 'true',
			oidcProviderName: values.get('oidcProviderName') ?? '',
			oidcProviderLogoURL: values.get('oidcProviderLogoUrl') ?? ''
		};
	}
} as const;

export interface AccessContext {
	currentUser: User | undefined;
	serverCapabilities: ServerCapabilities | undefined;
	permissionsManifest: PermissionsManifest | undefined;
	activeEnvironmentID: string;
	allEnvironmentsPreview: boolean;
}

export function canAccessTab(tab: AppTab, context: AccessContext): boolean {
	const supportsV2 = context.serverCapabilities?.mode === 'rbac';
	const user = context.currentUser;
	if ((!supportsV2 && requiresV2(tab)) || !user) return false;

	switch (tab) {
		case 'federatedCredentials':
			return User.hasPermission(user, 'federated:list');
		case 'systemBackups':
			return User.isGlobalAdmin(user) && User.hasPermission(user, 'system-backups:read');
		default:
			break;
	}

	const manifest = context.permissionsManifest;
	const surfaces = accessSurfaceIDs(tab);
	if (supportsV2 && manifest && manifest.accessSurfaces.length > 0 && surfaces.length > 0) {
		const scopes =
			context.allEnvironmentsPreview && isEnvironmentScoped(tab)
				? [...new Set([context.activeEnvironmentID, ...Object.keys(user.permissionsByEnv ?? {})])]
				: [context.activeEnvironmentID];
		return scopes.some((scope) =>
			surfaces.some((surfaceID) =>
				PermissionsManifest.canAccessSurface(manifest, surfaceID, user, scope)
			)
		);
	}

	return User.isAdmin(user) || !requiresAdmin(tab);
}
