import { usePermissionCheck } from '@/core/auth/permissions';
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
	const can = usePermissionCheck();
	const user = useClientManager((s) => s.currentUser);
	const capabilities = useClientManager((s) => s.serverCapabilities);
	const supportsRBAC =
		capabilities !== undefined && ServerCapabilities.supportsRoleManagement(capabilities);
	const isAdmin = user !== undefined && User.isAdmin(user);
	const allowed = (permission: string) => (supportsRBAC ? can(permission, null) : isAdmin);
	return {
		supportsRBAC,
		canCreate: allowed(Permission.ApiKeys.create),
		canUpdate: allowed(Permission.ApiKeys.update),
		canDelete: allowed(Permission.ApiKeys.delete),
		canListUsers: allowed(Permission.Users.list)
	};
}
