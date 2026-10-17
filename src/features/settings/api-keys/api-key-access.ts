/**
 * The API-key permission checks APIKeysView / APIKeyDetailView / CreateAPIKeyView
 * share: v1 servers gate everything on admin, v2 on global `apikeys:*` grants.
 */
import { hasPermission } from '@/core/auth/permissions';
import { ServerCapabilities } from '@/sdk/client/ServerCapabilities';
import { Permission } from '@/sdk/models/role/Permission';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';

export type APIKeyAccess = {
	supportsRBAC: boolean;
	canCreate: boolean;
	canUpdate: boolean;
	canDelete: boolean;
	canListUsers: boolean;
};

export function useAPIKeyAccess(): APIKeyAccess {
	useClientManager((s) => s.accessGeneration);
	const user = useClientManager((s) => s.currentUser);
	const capabilities = useClientManager((s) => s.serverCapabilities);
	const supportsRBAC =
		capabilities !== undefined && ServerCapabilities.supportsRoleManagement(capabilities);
	const isAdmin = user !== undefined && User.isAdmin(user);
	const allowed = (permission: string) =>
		supportsRBAC ? hasPermission(permission, null) : isAdmin;
	return {
		supportsRBAC,
		canCreate: allowed(Permission.ApiKeys.create),
		canUpdate: allowed(Permission.ApiKeys.update),
		canDelete: allowed(Permission.ApiKeys.delete),
		canListUsers: allowed(Permission.Users.list)
	};
}
