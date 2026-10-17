/** Port of Models/Role/PermissionsManifest.swift. */
import { D } from '../base/decoding';
import { User } from '../user/User';
import { Permission } from './Permission';

export type PermissionResourceScope = 'global' | 'env';

export const PermissionResourceScope = {
	global: 'global',
	env: 'env',
	/** Swift `PermissionResourceScope(rawValue:)`. */
	fromRawValue(raw: string): PermissionResourceScope | undefined {
		return raw === 'global' || raw === 'env' ? raw : undefined;
	}
} as const;

export interface PermissionsManifest {
	resources: PermissionResource[];
	presets: PermissionPreset[];
	accessSurfaces: AccessSurface[];
}

export interface PermissionResource {
	key: string;
	label: string;
	scope: string;
	actions: PermissionAction[];
}

export const PermissionResource = {
	decode(this: void, raw: unknown): PermissionResource {
		const o = D.object(raw, 'PermissionResource');
		return {
			key: D.string(o, 'key'),
			label: D.string(o, 'label'),
			scope: D.string(o, 'scope'),
			actions: D.array(o, 'actions', PermissionAction.decode)
		};
	},

	id(this: void, value: PermissionResource): string {
		return value.key;
	},

	scopeKind(this: void, value: PermissionResource): PermissionResourceScope | undefined {
		return PermissionResourceScope.fromRawValue(value.scope);
	}
} as const;

export interface PermissionAction {
	key: string;
	permission: string;
	label: string;
	description?: string;
	requires: string[];
}

export const PermissionAction = {
	make(
		this: void,
		init: {
			key: string;
			permission: string;
			label: string;
			description?: string;
			requires?: string[];
		}
	): PermissionAction {
		return {
			key: init.key,
			permission: init.permission,
			label: init.label,
			description: init.description,
			requires: init.requires ?? []
		};
	},

	decode(this: void, raw: unknown): PermissionAction {
		const o = D.object(raw, 'PermissionAction');
		return {
			key: D.string(o, 'key'),
			permission: D.string(o, 'permission'),
			label: D.string(o, 'label'),
			description: D.optString(o, 'description'),
			requires: D.optArray(o, 'requires', D.str) ?? []
		};
	},

	id(this: void, value: PermissionAction): string {
		return value.permission;
	}
} as const;

export interface PermissionPreset {
	key: string;
	label: string;
	description?: string;
	permissions: string[];
}

export const PermissionPreset = {
	make(
		this: void,
		init: {
			key: string;
			label: string;
			description?: string;
			permissions?: string[];
		}
	): PermissionPreset {
		return {
			key: init.key,
			label: init.label,
			description: init.description,
			permissions: init.permissions ?? []
		};
	},

	decode(this: void, raw: unknown): PermissionPreset {
		const o = D.object(raw, 'PermissionPreset');
		return {
			key: D.string(o, 'key'),
			label: D.string(o, 'label'),
			description: D.optString(o, 'description'),
			permissions: D.optArray(o, 'permissions', D.str) ?? []
		};
	},

	id(this: void, value: PermissionPreset): string {
		return value.key;
	}
} as const;

// MARK: - Access surface enums (open: unknown server values pass through)

export type AccessSurfaceKind =
	| 'route'
	| 'settings-category'
	| 'customize-category'
	| 'landing'
	| (string & {});

export const AccessSurfaceKind = {
	route: 'route',
	settingsCategory: 'settings-category',
	customizeCategory: 'customize-category',
	landing: 'landing',
	knownCases: ['route', 'settings-category', 'customize-category', 'landing'] as const,
	isKnown(value: AccessSurfaceKind): boolean {
		return (AccessSurfaceKind.knownCases as readonly string[]).includes(value);
	},
	unknown(raw: string): AccessSurfaceKind {
		return raw;
	},
	rawValue(value: AccessSurfaceKind): string {
		return value;
	},
	/** Swift single-value `init(from:)`: any string is accepted. */
	decode(raw: unknown): AccessSurfaceKind {
		return D.str(raw);
	}
} as const;

export type AccessSurfaceAccessMode = 'permissions' | 'any-child' | (string & {});

export const AccessSurfaceAccessMode = {
	permissions: 'permissions',
	anyChild: 'any-child',
	knownCases: ['permissions', 'any-child'] as const,
	isKnown(value: AccessSurfaceAccessMode): boolean {
		return (AccessSurfaceAccessMode.knownCases as readonly string[]).includes(value);
	},
	unknown(raw: string): AccessSurfaceAccessMode {
		return raw;
	},
	rawValue(value: AccessSurfaceAccessMode): string {
		return value;
	},
	decode(raw: unknown): AccessSurfaceAccessMode {
		return D.str(raw);
	}
} as const;

export type AccessSurfaceMatchMode = 'any-of' | 'all-of' | (string & {});

export const AccessSurfaceMatchMode = {
	anyOf: 'any-of',
	allOf: 'all-of',
	knownCases: ['any-of', 'all-of'] as const,
	isKnown(value: AccessSurfaceMatchMode): boolean {
		return (AccessSurfaceMatchMode.knownCases as readonly string[]).includes(value);
	},
	unknown(raw: string): AccessSurfaceMatchMode {
		return raw;
	},
	rawValue(value: AccessSurfaceMatchMode): string {
		return value;
	},
	decode(raw: unknown): AccessSurfaceMatchMode {
		return D.str(raw);
	}
} as const;

export type AccessSurfaceScopeMode =
	| 'global-only'
	| 'selected-env-plus-global'
	| 'any-effective-scope'
	| (string & {});

export const AccessSurfaceScopeMode = {
	globalOnly: 'global-only',
	selectedEnvironmentPlusGlobal: 'selected-env-plus-global',
	anyEffectiveScope: 'any-effective-scope',
	knownCases: ['global-only', 'selected-env-plus-global', 'any-effective-scope'] as const,
	isKnown(value: AccessSurfaceScopeMode): boolean {
		return (AccessSurfaceScopeMode.knownCases as readonly string[]).includes(value);
	},
	unknown(raw: string): AccessSurfaceScopeMode {
		return raw;
	},
	rawValue(value: AccessSurfaceScopeMode): string {
		return value;
	},
	decode(raw: unknown): AccessSurfaceScopeMode {
		return D.str(raw);
	}
} as const;

export interface AccessSurface {
	id: string;
	kind: AccessSurfaceKind;
	url?: string;
	label: string;
	accessMode: AccessSurfaceAccessMode;
	matchMode: AccessSurfaceMatchMode;
	scopeMode: AccessSurfaceScopeMode;
	permissions: string[];
	children: string[];
	fallbackOrder?: number;
}

export const AccessSurface = {
	make(
		this: void,
		init: {
			id: string;
			kind: AccessSurfaceKind;
			url?: string;
			label: string;
			accessMode: AccessSurfaceAccessMode;
			matchMode: AccessSurfaceMatchMode;
			scopeMode: AccessSurfaceScopeMode;
			permissions?: string[];
			children?: string[];
			fallbackOrder?: number;
		}
	): AccessSurface {
		return {
			id: init.id,
			kind: init.kind,
			url: init.url,
			label: init.label,
			accessMode: init.accessMode,
			matchMode: init.matchMode,
			scopeMode: init.scopeMode,
			permissions: init.permissions ?? [],
			children: init.children ?? [],
			fallbackOrder: init.fallbackOrder
		};
	},

	/** Swift `AccessSurface.init(from:)`: missing enums decode as `.unknown("")`. */
	decode(this: void, raw: unknown): AccessSurface {
		const o = D.object(raw, 'AccessSurface');
		return {
			id: D.string(o, 'id'),
			kind: D.optString(o, 'kind') ?? AccessSurfaceKind.unknown(''),
			url: D.optString(o, 'url'),
			label: D.optString(o, 'label') ?? '',
			accessMode: D.optString(o, 'accessMode') ?? AccessSurfaceAccessMode.unknown(''),
			matchMode: D.optString(o, 'matchMode') ?? AccessSurfaceMatchMode.unknown(''),
			scopeMode: D.optString(o, 'scopeMode') ?? AccessSurfaceScopeMode.unknown(''),
			permissions: D.optArray(o, 'permissions', D.str) ?? [],
			children: D.optArray(o, 'children', D.str) ?? [],
			fallbackOrder: D.optInt(o, 'fallbackOrder')
		};
	}
} as const;

function userHasPermissionInternal(
	user: User,
	permission: string,
	scopeMode: AccessSurfaceScopeMode,
	selectedEnvironmentID: string | undefined
): boolean {
	switch (scopeMode) {
		case AccessSurfaceScopeMode.globalOnly:
			return User.hasPermission(user, permission);
		case AccessSurfaceScopeMode.selectedEnvironmentPlusGlobal:
			return User.hasPermission(user, permission, selectedEnvironmentID);
		case AccessSurfaceScopeMode.anyEffectiveScope: {
			const permissionsByEnv = user.permissionsByEnv;
			if (permissionsByEnv === undefined) return User.isGlobalAdmin(user);
			return Object.values(permissionsByEnv).some(
				(permissions) => permissions.includes(Permission.sudo) || permissions.includes(permission)
			);
		}
		default:
			return false;
	}
}

function canAccessSurfaceInternal(
	id: string,
	user: User,
	selectedEnvironmentID: string | undefined,
	index: Map<string, AccessSurface>,
	visiting: Set<string>
): boolean {
	const surface = index.get(id);
	if (visiting.has(id) || surface === undefined) return false;

	switch (surface.accessMode) {
		case AccessSurfaceAccessMode.anyChild: {
			visiting.add(id);
			try {
				return surface.children.some((childID) =>
					canAccessSurfaceInternal(childID, user, selectedEnvironmentID, index, visiting)
				);
			} finally {
				visiting.delete(id);
			}
		}
		case AccessSurfaceAccessMode.permissions: {
			if (surface.permissions.length === 0) return false;
			const check = (permission: string) =>
				userHasPermissionInternal(user, permission, surface.scopeMode, selectedEnvironmentID);
			switch (surface.matchMode) {
				case AccessSurfaceMatchMode.allOf:
					return surface.permissions.every(check);
				case AccessSurfaceMatchMode.anyOf:
					return surface.permissions.some(check);
				default:
					return false;
			}
		}
		default:
			return false;
	}
}

export const PermissionsManifest = {
	make(
		this: void,
		init: {
			resources: PermissionResource[];
			presets?: PermissionPreset[];
			accessSurfaces?: AccessSurface[];
		}
	): PermissionsManifest {
		return {
			resources: init.resources,
			presets: init.presets ?? [],
			accessSurfaces: init.accessSurfaces ?? []
		};
	},

	/** Swift `PermissionsManifest.init(from:)`: every list defaults to `[]`. */
	decode(this: void, raw: unknown): PermissionsManifest {
		const o = D.object(raw, 'PermissionsManifest');
		return {
			resources: D.optArray(o, 'resources', PermissionResource.decode) ?? [],
			presets: D.optArray(o, 'presets', PermissionPreset.decode) ?? [],
			accessSurfaces: D.optArray(o, 'accessSurfaces', AccessSurface.decode) ?? []
		};
	},

	/**
	 * Adds every transitive `PermissionAction.requires` dependency while
	 * preserving the caller's selection order.
	 */
	normalizePermissionSelection(
		this: void,
		manifest: PermissionsManifest,
		selected: string[]
	): string[] {
		const requirements = new Map<string, string[]>();
		for (const resource of manifest.resources) {
			for (const action of resource.actions) {
				requirements.set(action.permission, action.requires);
			}
		}

		const seen = new Set<string>();
		const normalized: string[] = [];
		for (const permission of selected) {
			if (seen.has(permission)) continue;
			seen.add(permission);
			normalized.push(permission);
		}

		for (let index = 0; index < normalized.length; index += 1) {
			for (const required of requirements.get(normalized[index]!) ?? []) {
				if (seen.has(required)) continue;
				seen.add(required);
				normalized.push(required);
			}
		}
		return normalized;
	},

	/**
	 * Evaluates backend-owned access metadata for advisory UI gating.
	 * Backend authorization remains authoritative for actual requests.
	 */
	canAccessSurface(
		this: void,
		manifest: PermissionsManifest,
		id: string,
		user: User,
		selectedEnvironmentID?: string
	): boolean {
		const index = new Map<string, AccessSurface>();
		for (const surface of manifest.accessSurfaces) {
			index.set(surface.id, surface);
		}
		return canAccessSurfaceInternal(id, user, selectedEnvironmentID, index, new Set<string>());
	}
} as const;
