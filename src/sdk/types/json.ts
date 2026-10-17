export type JSONValue =
	| null
	| boolean
	| number
	| string
	| JSONValue[]
	| { [key: string]: JSONValue };

export type JSONObject = { [key: string]: JSONValue };

export const JSONValue = {
	isObject(this: void, value: unknown): value is JSONObject {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	},

	doubleValue(this: void, value: JSONValue | undefined): number | undefined {
		return typeof value === 'number' ? value : undefined;
	},

	intValue(this: void, value: JSONValue | undefined): number | undefined {
		if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
		return Math.trunc(value);
	},

	int64Value(this: void, value: JSONValue | undefined): number | undefined {
		return JSONValue.intValue(value);
	},

	stringValue(this: void, value: JSONValue | undefined): string | undefined {
		return typeof value === 'string' ? value : undefined;
	},

	boolValue(this: void, value: JSONValue | undefined): boolean | undefined {
		return typeof value === 'boolean' ? value : undefined;
	}
} as const;

export interface AnyDecodable {
	value: JSONValue;
}

export const AnyDecodable = {
	decode(raw: unknown): AnyDecodable {
		return { value: (raw ?? null) as JSONValue };
	}
} as const;
