/** Port of Models/Role/OidcRoleMapping.swift. */
import type { ISODateString } from '../base/date';

export type OidcRoleMappingSource = 'manual' | 'env';

export const OidcRoleMappingSource = {
	manual: 'manual',
	env: 'env',
	/** Swift `OidcRoleMappingSource(rawValue:)`. */
	fromRawValue(raw: string): OidcRoleMappingSource | undefined {
		return raw === 'manual' || raw === 'env' ? raw : undefined;
	}
} as const;

export interface OidcRoleMapping {
	id: string;
	claimValue: string;
	roleId: string;
	environmentId?: string;
	source: string;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
}

export const OidcRoleMapping = {
	/** Swift `OidcRoleMapping.init(...)`; `source` defaults to `"manual"`. */
	make(init: {
		id: string;
		claimValue: string;
		roleId: string;
		environmentId?: string;
		source?: string;
		createdAt: ISODateString;
		updatedAt?: ISODateString;
	}): OidcRoleMapping {
		return {
			id: init.id,
			claimValue: init.claimValue,
			roleId: init.roleId,
			environmentId: init.environmentId,
			source: init.source ?? OidcRoleMappingSource.manual,
			createdAt: init.createdAt,
			updatedAt: init.updatedAt
		};
	},

	sourceKind(value: OidcRoleMapping): OidcRoleMappingSource | undefined {
		return OidcRoleMappingSource.fromRawValue(value.source);
	}
} as const;

export interface CreateOidcRoleMapping {
	claimValue: string;
	roleId: string;
	environmentId?: string;
}

export interface UpdateOidcRoleMapping {
	claimValue: string;
	roleId: string;
	environmentId?: string;
}
