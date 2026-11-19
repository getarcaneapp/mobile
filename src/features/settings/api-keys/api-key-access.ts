import { usePermissionCheck } from '@/core/auth/permissions';
import { Permission } from '@/sdk/models/role/Permission';

export type APIKeyAccess = {
	canCreate: boolean;
	canUpdate: boolean;
	canDelete: boolean;
	canListUsers: boolean;
};

export function useAPIKeyAccess(): APIKeyAccess {
	const can = usePermissionCheck();
	const allowed = (permission: string) => can(permission, null);
	return {
		canCreate: allowed(Permission.ApiKeys.create),
		canUpdate: allowed(Permission.ApiKeys.update),
		canDelete: allowed(Permission.ApiKeys.delete),
		canListUsers: allowed(Permission.Users.list)
	};
}
