/**
 * Small, dependency-free helpers for porting Swift `init(from decoder:)`
 * implementations. Every decoder receives `unknown` (already JSON-parsed,
 * with object-level `null`s removed by the transport, see `parseArcaneJSON`)
 * and either returns the typed model or throws `DecodingError`.
 *
 * Mapping from Swift:
 *   container.decode(String.self, forKey: .x)            → D.string(o, "x")
 *   container.decodeIfPresent(String.self, forKey: .x)   → D.optString(o, "x")
 *   try? container.decode(...)                           → D.attempt(() => ...)
 *   container.decode([T].self, forKey: .x)               → D.array(o, "x", T.decode)
 *   decodeEmptyDictionaryIfPresent                       → D.optRecord(o, "x", fn) ?? {}
 *
 * The transport wraps any error thrown by a decoder in `ArcaneError.decoding`.
 */

export class DecodingError extends Error {
	readonly path: string;
	constructor(message: string, path = '') {
		super(path ? `${message} at ${path}` : message);
		this.name = 'DecodingError';
		this.path = path;
	}
}

export type Decoder<T> = (raw: unknown) => T;
export type RawObject = Record<string, unknown>;

function describe(value: unknown): string {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'array';
	return typeof value;
}

function isRecord(value: unknown): value is RawObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Swift `decoder.container(keyedBy:)`: the raw value must be an object. */
export function object(raw: unknown, context = 'value'): RawObject {
	if (!isRecord(raw)) {
		throw new DecodingError(`Expected object for ${context}, found ${describe(raw)}`);
	}
	return raw;
}

function present(o: RawObject, key: string): boolean {
	return o[key] !== undefined && o[key] !== null;
}

function required<T>(o: RawObject, key: string, check: (v: unknown) => v is T, type: string): T {
	const value = o[key];
	if (value === undefined || value === null) {
		throw new DecodingError(`Missing required key "${key}"`, key);
	}
	if (!check(value)) {
		throw new DecodingError(`Expected ${type}, found ${describe(value)}`, key);
	}
	return value;
}

function optional<T>(
	o: RawObject,
	key: string,
	check: (v: unknown) => v is T,
	type: string
): T | undefined {
	if (!present(o, key)) return undefined;
	const value = o[key];
	if (!check(value)) {
		throw new DecodingError(`Expected ${type}, found ${describe(value)}`, key);
	}
	return value;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

/** Parses a number from a JSON number or a numeric string. */
function coerceNumber(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value.trim());
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
}

export const D = {
	object,
	isRecord,
	has(this: void, o: RawObject, key: string): boolean {
		return present(o, key);
	},
	/** Swift `container.contains(key)` (true even when the value is null). */
	contains(this: void, o: RawObject, key: string): boolean {
		return Object.prototype.hasOwnProperty.call(o, key);
	},

	string(this: void, o: RawObject, key: string): string {
		return required(o, key, isString, 'string');
	},
	optString(this: void, o: RawObject, key: string): string | undefined {
		return optional(o, key, isString, 'string');
	},
	number(this: void, o: RawObject, key: string): number {
		return required(o, key, isNumber, 'number');
	},
	optNumber(this: void, o: RawObject, key: string): number | undefined {
		return optional(o, key, isNumber, 'number');
	},
	/** Swift `Int`: truncates nothing, but rejects non-integral values. */
	int(this: void, o: RawObject, key: string): number {
		const value = required(o, key, isNumber, 'number');
		if (!Number.isInteger(value)) throw new DecodingError('Expected integer', key);
		return value;
	},
	optInt(this: void, o: RawObject, key: string): number | undefined {
		const value = optional(o, key, isNumber, 'number');
		if (value !== undefined && !Number.isInteger(value)) {
			throw new DecodingError('Expected integer', key);
		}
		return value;
	},
	boolean(this: void, o: RawObject, key: string): boolean {
		return required(o, key, isBoolean, 'boolean');
	},
	optBoolean(this: void, o: RawObject, key: string): boolean | undefined {
		return optional(o, key, isBoolean, 'boolean');
	},

	array<T>(this: void, o: RawObject, key: string, element: Decoder<T>): T[] {
		return required(o, key, isArray, 'array').map((item, index) => {
			try {
				return element(item);
			} catch (error) {
				throw rethrow(error, `${key}[${index}]`);
			}
		});
	},
	optArray<T>(this: void, o: RawObject, key: string, element: Decoder<T>): T[] | undefined {
		if (!present(o, key)) return undefined;
		return D.array(o, key, element);
	},
	/** `[String: T]` */
	record<T>(this: void, o: RawObject, key: string, value: Decoder<T>): Record<string, T> {
		const raw = required(o, key, isRecord, 'object');
		return mapRecord(raw, value, key);
	},
	optRecord<T>(
		this: void,
		o: RawObject,
		key: string,
		value: Decoder<T>
	): Record<string, T> | undefined {
		if (!present(o, key)) return undefined;
		return D.record(o, key, value);
	},
	/** Decode a nested model with its decoder. */
	nested<T>(this: void, o: RawObject, key: string, decode: Decoder<T>): T {
		if (!present(o, key)) throw new DecodingError(`Missing required key "${key}"`, key);
		try {
			return decode(o[key]);
		} catch (error) {
			throw rethrow(error, key);
		}
	},
	optNested<T>(this: void, o: RawObject, key: string, decode: Decoder<T>): T | undefined {
		if (!present(o, key)) return undefined;
		return D.nested(o, key, decode);
	},

	/** Value that may be a JSON number or a numeric string. */
	optStringOrNumber(this: void, o: RawObject, key: string): number | undefined {
		return present(o, key) ? coerceNumber(o[key]) : undefined;
	},
	/** Value that may be a JSON string or a number; always returns a string. */
	optStringFromAny(this: void, o: RawObject, key: string): string | undefined {
		if (!present(o, key)) return undefined;
		const value = o[key];
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		return undefined;
	},
	coerceNumber,

	/** Swift `try?`: returns `undefined` instead of throwing. */
	attempt<T>(this: void, fn: () => T): T | undefined {
		try {
			return fn();
		} catch {
			return undefined;
		}
	},

	/** Element decoders for primitive arrays/records. */
	str(this: void, raw: unknown): string {
		if (typeof raw !== 'string') throw new DecodingError(`Expected string, found ${describe(raw)}`);
		return raw;
	},
	num(this: void, raw: unknown): number {
		if (typeof raw !== 'number') throw new DecodingError(`Expected number, found ${describe(raw)}`);
		return raw;
	},
	bool(this: void, raw: unknown): boolean {
		if (typeof raw !== 'boolean') {
			throw new DecodingError(`Expected boolean, found ${describe(raw)}`);
		}
		return raw;
	},
	/** Identity decoder for plain (synthesized Codable) models: a typed cast. */
	cast<T>(this: void, raw: unknown): T {
		return raw as T;
	}
} as const;

export function mapRecord<T>(raw: RawObject, value: Decoder<T>, path = ''): Record<string, T> {
	const result: Record<string, T> = {};
	for (const [key, item] of Object.entries(raw)) {
		if (item === undefined) continue;
		try {
			result[key] = value(item);
		} catch (error) {
			throw rethrow(error, path ? `${path}.${key}` : key);
		}
	}
	return result;
}

function rethrow(error: unknown, path: string): Error {
	if (error instanceof DecodingError) {
		return new DecodingError(
			error.message.replace(/ at .*$/, ''),
			error.path ? `${path}.${error.path}` : path
		);
	}
	return error instanceof Error ? error : new DecodingError(String(error), path);
}

/** Decoder for `[T]` responses. */
export function decodeArray<T>(element: Decoder<T>): Decoder<T[]> {
	return (raw) => {
		if (!Array.isArray(raw)) throw new DecodingError(`Expected array, found ${describe(raw)}`);
		return raw.map((item, index) => {
			try {
				return element(item);
			} catch (error) {
				throw rethrow(error, `[${index}]`);
			}
		});
	};
}

/** Decoder for `T?` responses. */
export function decodeOptional<T>(inner: Decoder<T>): Decoder<T | undefined> {
	return (raw) => (raw === undefined || raw === null ? undefined : inner(raw));
}

/**
 * Port of a Swift `String`-raw enum with an unknown-case fallback:
 * returns `raw` if it is a string, otherwise `fallback`.
 */
export function decodeEnumString<T extends string>(raw: unknown, fallback: T): T | (string & {}) {
	return typeof raw === 'string' ? raw : fallback;
}
