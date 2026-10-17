export interface EnvVariable {
	key: string;
	value: string;
}

export interface EnvVariables {
	variables: EnvVariable[];
}

export const EnvVariables = {
	make(args: { variables?: EnvVariable[] } = {}): EnvVariables {
		return { variables: args.variables ?? [] };
	}
} as const;
