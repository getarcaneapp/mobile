/**
 * Port of RBACModels.swift (Role display helpers, assignment identity, scope
 * labels, validation formatting) plus the `Permissions.canManageRoles` /
 * `canManageOIDCMappings` checks (PermissionsHelper.swift) and the shared
 * "collect every role / environment" loaders the RBAC screens use.
 */
import { PaginationLoader } from '@/core/networking/pagination-loader';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { ServerCapabilities } from '@/sdk/client/ServerCapabilities';
import { ArcaneConflictError, ArcaneValidationError } from '@/sdk/errors/ArcaneError';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { Permission } from '@/sdk/models/role/Permission';
import { Role } from '@/sdk/models/role/Role';
import { RoleAssignment, RoleAssignmentSource } from '@/sdk/models/role/RoleAssignment';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { systemColors } from '@/theme/colors';

/** `Role.displayName`: falls back to the role ID. */
export function roleDisplayName(role: Role): string {
	return role.name === '' ? role.id : role.name;
}

/** `Role.systemImage`: built-ins get distinctive icons; custom roles a generic badge. */
export function roleSystemImage(role: Role): string {
	switch (role.id) {
		case Role.BuiltIn.admin:
			return 'lock.shield.fill';
		case Role.BuiltIn.editor:
		case Role.BuiltIn.noShellEditor:
			return 'pencil.circle.fill';
		case Role.BuiltIn.deployer:
			return 'shippingbox.fill';
		case Role.BuiltIn.monitor:
			return 'eye.fill';
		case Role.BuiltIn.viewer:
			return 'doc.text.fill';
		default:
			return 'person.crop.rectangle.fill';
	}
}

/** `Role.iconColor`. */
export function roleIconColor(role: Role): string {
	switch (role.id) {
		case Role.BuiltIn.admin:
			return systemColors.indigo;
		case Role.BuiltIn.editor:
		case Role.BuiltIn.noShellEditor:
			return systemColors.blue;
		case Role.BuiltIn.deployer:
			return systemColors.orange;
		case Role.BuiltIn.monitor:
			return systemColors.teal;
		case Role.BuiltIn.viewer:
			return systemColors.gray;
		default:
			return systemColors.purple;
	}
}

/** `RoleAssignmentSummary.id`: roleId + scope is unique per user. */
export function assignmentKey(assignment: { roleId: string; environmentId?: string }): string {
	return `${assignment.roleId}#${assignment.environmentId ?? 'global'}`;
}

export function isManualAssignment(assignment: RoleAssignment): boolean {
	return RoleAssignment.sourceKind(assignment) === RoleAssignmentSource.manual;
}

/** `displayScopeLabel(for:environments:)`. */
export function displayScopeLabel(
	environmentId: string | undefined,
	environments: Environment[]
): string {
	if (environmentId === undefined) return 'Global';
	const environment = environments.find((env) => env.id === environmentId);
	if (environment) return environment.name ?? `Environment ${environmentId}`;
	return `Environment ${environmentId}`;
}

/** `Text(env.name ?? "Environment \(env.id)")` in the environment pickers. */
export function environmentPickerName(environment: Environment): string {
	return environment.name ?? `Environment ${environment.id}`;
}

/** `formatValidationFields(_:)`: "field: message, message" lines sorted by field. */
export function formatValidationFields(fields: Record<string, string[]>): string {
	return Object.entries(fields)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([key, messages]) => `${key}: ${messages.join(', ')}`)
		.join('\n');
}

/** `catch let ArcaneError.validation(fields)`. */
export function validationFields(error: unknown): Record<string, string[]> | undefined {
	return error instanceof ArcaneValidationError ? error.fields : undefined;
}

/** `catch let ArcaneError.conflict(message)`; `message` is undefined when the server sent none. */
export function conflictMessage(error: unknown): { message: string | undefined } | undefined {
	return error instanceof ArcaneConflictError ? { message: error.conflictMessage } : undefined;
}

/** `manager.serverCapabilities?.supportsRoleManagement == true`. */
export function useSupportsRoleManagement(): boolean {
	const capabilities = useClientManager((s) => s.serverCapabilities);
	return capabilities !== undefined && ServerCapabilities.supportsRoleManagement(capabilities);
}

/** `manager.permissions.canManageRoles`. */
export function useCanManageRoles(): boolean {
	const user = useClientManager((s) => s.currentUser);
	const supportsRBAC = useSupportsRoleManagement();
	if (!user) return false;
	if (!supportsRBAC) return User.isAdmin(user);
	return User.isGlobalAdmin(user) || User.hasPermission(user, Permission.Roles.list);
}

/** `manager.permissions.canManageOIDCMappings`: reserved for global admins. */
export function useCanManageOIDCMappings(): boolean {
	const user = useClientManager((s) => s.currentUser);
	const supportsRBAC = useSupportsRoleManagement();
	if (!user) return false;
	if (!supportsRBAC) return User.isAdmin(user);
	return User.isGlobalAdmin(user);
}

/** `PaginationLoader.collect { client.roles.listPaginated(start:limit:) }`. */
export function collectAllRoles(client: ArcaneClient): Promise<Role[]> {
	return PaginationLoader.collect(async (start, limit) => {
		const response = await client.roles.listPaginated({ start, limit });
		return { items: response.data, pagination: response.pagination };
	});
}

/** Every environment sorted by name (`sortBy: "name", sortOrder: .ascending`). */
export function collectAllEnvironments(client: ArcaneClient): Promise<Environment[]> {
	return PaginationLoader.collect(async (start, limit) => {
		const response = await client.environments.list({
			query: { start, limit, sortBy: 'name', sortOrder: 'asc' }
		});
		return { items: response.data, pagination: response.pagination };
	});
}

/** The `Scope` picker in the assignment / mapping sheets. */
export type AssignmentScope = 'global' | 'environment';

export const assignmentScopeOptions: { value: AssignmentScope; label: string }[] = [
	{ value: 'global', label: 'Global' },
	{ value: 'environment', label: 'Specific Environment' }
];
