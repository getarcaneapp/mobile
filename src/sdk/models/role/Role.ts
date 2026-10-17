/** Port of Models/Role/Role.swift. */
import type { ISODateString } from '../base/date';
import { D } from '../base/decoding';

export interface Role {
	id: string;
	name: string;
	description?: string;
	permissions: string[];
	builtIn: boolean;
	assignedUserCount: number;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
}

export const Role = {
	/** Swift `Role.init(...)` with its defaults. */
	make(
		this: void,
		init: {
			id: string;
			name: string;
			description?: string;
			permissions?: string[];
			builtIn?: boolean;
			assignedUserCount?: number;
			createdAt: ISODateString;
			updatedAt?: ISODateString;
		}
	): Role {
		return {
			id: init.id,
			name: init.name,
			description: init.description,
			permissions: init.permissions ?? [],
			builtIn: init.builtIn ?? false,
			assignedUserCount: init.assignedUserCount ?? 0,
			createdAt: init.createdAt,
			updatedAt: init.updatedAt
		};
	},

	/** Swift `Role.init(from:)`: missing collections/flags fall back to defaults. */
	decode(this: void, raw: unknown): Role {
		const o = D.object(raw, 'Role');
		return {
			id: D.string(o, 'id'),
			name: D.string(o, 'name'),
			description: D.optString(o, 'description'),
			permissions: D.optArray(o, 'permissions', D.str) ?? [],
			builtIn: D.optBoolean(o, 'builtIn') ?? false,
			assignedUserCount: D.optInt(o, 'assignedUserCount') ?? 0,
			createdAt: D.string(o, 'createdAt'),
			updatedAt: D.optString(o, 'updatedAt')
		};
	},

	/**
	 * Stable built-in role IDs seeded by the v2 backend migration. Custom
	 * roles will have any other ID and are user-defined.
	 */
	BuiltIn: {
		admin: 'role_admin',
		editor: 'role_editor',
		noShellEditor: 'role_no_shell_editor',
		deployer: 'role_deployer',
		monitor: 'role_monitor',
		viewer: 'role_viewer'
	}
} as const;

export interface CreateRole {
	name: string;
	description?: string;
	permissions: string[];
}

export interface UpdateRole {
	name: string;
	description?: string;
	permissions: string[];
}
