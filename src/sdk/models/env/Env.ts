/** Port of Models/Env/Env.swift. */

/** EnvVariable is a generic `KEY=value` template variable. */
export interface EnvVariable {
	key: string;
	value: string;
}

/** EnvVariables wraps a collection of variables for endpoints that accept a `variables` array. */
export interface EnvVariables {
	variables: EnvVariable[];
}

export const EnvVariables = {
	make(args: { variables?: EnvVariable[] } = {}): EnvVariables {
		return { variables: args.variables ?? [] };
	}
} as const;
