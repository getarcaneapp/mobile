/** Port of Models/Variable/Variable.swift. */
import { D, DecodingError } from '../base/decoding';
import type { ISODateString } from '../base/date';

/**
 * A manager-owned variable that is materialized into one or more environments.
 * Secret values are redacted by the server when read.
 */
export interface GlobalVariable {
	id: string;
	key: string;
	value: string;
	isSecret: boolean;
	allEnvironments: boolean;
	/** JSON key `environmentIds`. */
	environmentIDs: string[];
	createdAt: ISODateString;
	updatedAt?: ISODateString;
}

export const GlobalVariable = {
	make(
		this: void,
		args: {
			id: string;
			key: string;
			value: string;
			isSecret?: boolean;
			allEnvironments?: boolean;
			environmentIDs?: string[];
			createdAt: ISODateString;
			updatedAt?: ISODateString;
		}
	): GlobalVariable {
		return {
			id: args.id,
			key: args.key,
			value: args.value,
			isSecret: args.isSecret ?? false,
			allEnvironments: args.allEnvironments ?? false,
			environmentIDs: args.environmentIDs ?? [],
			createdAt: args.createdAt,
			updatedAt: args.updatedAt
		};
	},

	decode(this: void, raw: unknown): GlobalVariable {
		const o = D.object(raw, 'GlobalVariable');
		return {
			id: D.string(o, 'id'),
			key: D.string(o, 'key'),
			value: D.optString(o, 'value') ?? '',
			isSecret: D.optBoolean(o, 'isSecret') ?? false,
			allEnvironments: D.optBoolean(o, 'allEnvironments') ?? false,
			environmentIDs: D.optArray(o, 'environmentIds', D.str) ?? [],
			createdAt: D.string(o, 'createdAt'),
			updatedAt: D.optString(o, 'updatedAt')
		};
	},

	encode(this: void, value: GlobalVariable): Record<string, unknown> {
		return {
			id: value.id,
			key: value.key,
			value: value.value,
			isSecret: value.isSecret,
			allEnvironments: value.allEnvironments,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
			environmentIds: value.environmentIDs
		};
	}
} as const;

export interface CreateGlobalVariableRequest {
	key: string;
	value: string;
	isSecret: boolean;
	allEnvironments: boolean;
	/** JSON key `environmentIds`. */
	environmentIDs: string[];
}

export const CreateGlobalVariableRequest = {
	make(args: {
		key: string;
		value: string;
		isSecret?: boolean;
		allEnvironments?: boolean;
		environmentIDs?: string[];
	}): CreateGlobalVariableRequest {
		return {
			key: args.key,
			value: args.value,
			isSecret: args.isSecret ?? false,
			allEnvironments: args.allEnvironments ?? false,
			environmentIDs: args.environmentIDs ?? []
		};
	},

	decode(raw: unknown): CreateGlobalVariableRequest {
		const o = D.object(raw, 'CreateGlobalVariableRequest');
		return {
			key: D.string(o, 'key'),
			value: D.string(o, 'value'),
			isSecret: D.boolean(o, 'isSecret'),
			allEnvironments: D.boolean(o, 'allEnvironments'),
			environmentIDs: D.array(o, 'environmentIds', D.str)
		};
	},

	encode(value: CreateGlobalVariableRequest): Record<string, unknown> {
		return {
			key: value.key,
			value: value.value,
			isSecret: value.isSecret,
			allEnvironments: value.allEnvironments,
			environmentIds: value.environmentIDs
		};
	}
} as const;

/**
 * Partial update. An undefined value preserves the current field; an empty
 * `environmentIDs` array explicitly clears environment-specific scope.
 */
export interface UpdateGlobalVariableRequest {
	key?: string;
	value?: string;
	isSecret?: boolean;
	allEnvironments?: boolean;
	/** JSON key `environmentIds`. */
	environmentIDs?: string[];
}

export const UpdateGlobalVariableRequest = {
	decode(raw: unknown): UpdateGlobalVariableRequest {
		const o = D.object(raw, 'UpdateGlobalVariableRequest');
		return {
			key: D.optString(o, 'key'),
			value: D.optString(o, 'value'),
			isSecret: D.optBoolean(o, 'isSecret'),
			allEnvironments: D.optBoolean(o, 'allEnvironments'),
			environmentIDs: D.optArray(o, 'environmentIds', D.str)
		};
	},

	encode(value: UpdateGlobalVariableRequest): Record<string, unknown> {
		return {
			key: value.key,
			value: value.value,
			isSecret: value.isSecret,
			allEnvironments: value.allEnvironments,
			environmentIds: value.environmentIDs
		};
	}
} as const;

/**
 * Current materialization state for a manager-owned variable in an environment.
 * Unknown server values are preserved so newer backends remain decodable.
 */
export type VariableSyncState = 'synced' | 'pending' | 'error' | (string & {});

export const VariableSyncState = {
	synced: 'synced',
	pending: 'pending',
	error: 'error',
	knownCases: ['synced', 'pending', 'error'] as const,

	isKnown(this: void, value: VariableSyncState): value is 'synced' | 'pending' | 'error' {
		return (VariableSyncState.knownCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): VariableSyncState {
		return raw;
	},
	rawValue(this: void, value: VariableSyncState): string {
		return value;
	},

	decode(this: void, raw: unknown): VariableSyncState {
		if (typeof raw !== 'string') throw new DecodingError('Expected string for VariableSyncState');
		return raw;
	},
	encode(this: void, value: VariableSyncState): string {
		return value;
	}
} as const;

export interface EnvironmentSyncStatus {
	/** JSON key `environmentId`. */
	environmentID: string;
	environmentName?: string;
	status: VariableSyncState;
	error?: string;
	lastSyncedAt?: ISODateString;
}

export const EnvironmentSyncStatus = {
	/** Swift `Identifiable.id`. */
	id(this: void, value: EnvironmentSyncStatus): string {
		return value.environmentID;
	},

	decode(this: void, raw: unknown): EnvironmentSyncStatus {
		const o = D.object(raw, 'EnvironmentSyncStatus');
		return {
			environmentID: D.string(o, 'environmentId'),
			environmentName: D.optString(o, 'environmentName'),
			status: D.optNested(o, 'status', VariableSyncState.decode) ?? VariableSyncState.unknown(''),
			error: D.optString(o, 'error'),
			lastSyncedAt: D.optString(o, 'lastSyncedAt')
		};
	},

	encode(this: void, value: EnvironmentSyncStatus): Record<string, unknown> {
		return {
			environmentId: value.environmentID,
			environmentName: value.environmentName,
			status: value.status,
			error: value.error,
			lastSyncedAt: value.lastSyncedAt
		};
	}
} as const;

export interface GlobalVariableMutationResponse {
	variable?: GlobalVariable;
	syncResults: EnvironmentSyncStatus[];
}

export const GlobalVariableMutationResponse = {
	make(
		this: void,
		args: { variable?: GlobalVariable; syncResults?: EnvironmentSyncStatus[] } = {}
	): GlobalVariableMutationResponse {
		return { variable: args.variable, syncResults: args.syncResults ?? [] };
	},

	decode(this: void, raw: unknown): GlobalVariableMutationResponse {
		const o = D.object(raw, 'GlobalVariableMutationResponse');
		return {
			variable: D.optNested(o, 'variable', GlobalVariable.decode),
			syncResults: D.optArray(o, 'syncResults', EnvironmentSyncStatus.decode) ?? []
		};
	},

	encode(this: void, value: GlobalVariableMutationResponse): Record<string, unknown> {
		return {
			variable: value.variable === undefined ? undefined : GlobalVariable.encode(value.variable),
			syncResults: value.syncResults.map(EnvironmentSyncStatus.encode)
		};
	}
} as const;
