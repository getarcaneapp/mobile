import { usePermissionCheck } from '@/core/auth/permissions';
import { Permission } from '@/sdk/models/role/Permission';

export function useTemplatePermissions() {
	const can = usePermissionCheck();
	const has = (perm: string) => can(perm, null);
	const canList = has(Permission.Templates.list);
	const canRead = has(Permission.Templates.read);
	const canCreate = has(Permission.Templates.create);
	const canUpdate = has(Permission.Templates.update);
	const canDelete = has(Permission.Templates.delete);
	return {
		canList,
		canRead,
		canCreate,
		canUpdate,
		canDelete,
		canEditDefaults: canRead && canUpdate,
		canManageRegistries: canList && (canCreate || canUpdate || canDelete)
	};
}
