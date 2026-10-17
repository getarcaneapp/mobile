import { hasPermission } from '@/core/auth/permissions';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';

export function useTemplatePermissions() {
	useClientManager((s) => s.accessGeneration);
	useClientManager((s) => s.currentUser);
	const has = (perm: string) => hasPermission(perm, null);
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
