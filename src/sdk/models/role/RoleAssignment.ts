import type { ISODateString } from '../base/date';

export type RoleAssignmentSource = 'manual' | 'oidc';

export const RoleAssignmentSource = {
	manual: 'manual',
	oidc: 'oidc',
	fromRawValue(raw: string): RoleAssignmentSource | undefined {
		return raw === 'manual' || raw === 'oidc' ? raw : undefined;
	}
} as const;

export interface RoleAssignment {
	id: string;
	userId: string;
	roleId: string;
	environmentId?: string;
	source: string;
	createdAt: ISODateString;
}

export const RoleAssignment = {
	make(init: {
		id: string;
		userId: string;
		roleId: string;
		environmentId?: string;
		source?: string;
		createdAt: ISODateString;
	}): RoleAssignment {
		return {
			id: init.id,
			userId: init.userId,
			roleId: init.roleId,
			environmentId: init.environmentId,
			source: init.source ?? RoleAssignmentSource.manual,
			createdAt: init.createdAt
		};
	},

	sourceKind(value: RoleAssignment): RoleAssignmentSource | undefined {
		return RoleAssignmentSource.fromRawValue(value.source);
	}
} as const;

export interface RoleAssignmentSummary {
	roleId: string;
	environmentId?: string;
	source: string;
}

export const RoleAssignmentSummary = {
	make(init: { roleId: string; environmentId?: string; source?: string }): RoleAssignmentSummary {
		return {
			roleId: init.roleId,
			environmentId: init.environmentId,
			source: init.source ?? RoleAssignmentSource.manual
		};
	},

	sourceKind(value: RoleAssignmentSummary): RoleAssignmentSource | undefined {
		return RoleAssignmentSource.fromRawValue(value.source);
	}
} as const;

export interface UserAssignmentInput {
	roleId: string;
	environmentId?: string;
}

export interface SetUserAssignments {
	assignments: UserAssignmentInput[];
}
