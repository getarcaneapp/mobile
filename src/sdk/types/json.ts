/**
 * Port of `JSONValue` (Models/Base/JSONValue.swift).
 *
 * Swift models it as an enum (`.null`, `.bool`, `.number`, `.string`,
 * `.array`, `.object`). In TypeScript the parsed JSON value itself already
 * carries that information, so `JSONValue` is the structural JSON type and
 * the Swift accessor properties are exposed as companion functions:
 * `value.doubleValue` → `JSONValue.doubleValue(value)`.
 */
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

	/** Truncates toward zero, matching `Int(exactly: value.rounded(.towardZero))`. */
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

/** Port of `AnyDecodable` (HTTP/RESTService.swift). */
export interface AnyDecodable {
	value: JSONValue;
}

export const AnyDecodable = {
	decode(raw: unknown): AnyDecodable {
		return { value: (raw ?? null) as JSONValue };
	}
} as const;
