/**
 * Date convention for the TypeScript SDK.
 *
 * Swift `Date` fields are ISO-8601 strings on the wire (`ArcaneJSON` accepts
 * them with or without fractional seconds). The TS port keeps them as the
 * original string, typed `ISODateString`, so plain models can be used as
 * parsed JSON without a decoding pass. Use `parseArcaneDate` when a `Date` is
 * needed and `formatArcaneDate` to produce one for a request body
 * (`JSONEncoder.dateEncodingStrategy = .iso8601`, no fractional seconds).
 */
export type ISODateString = string;

const ISO_PATTERN =
	/^(\d{4}-\d{2}-\d{2})[Tt](\d{2}:\d{2}:\d{2})(?:\.(\d+))?([Zz]|[+-]\d{2}:?\d{2})$/;

/**
 * Parses an Arcane timestamp. Accepts RFC 3339 with or without fractional
 * seconds (any precision; Go emits nanoseconds) and returns `undefined` for
 * anything else, matching the two `ISO8601DateFormatter`s in `ArcaneJSON`.
 */
export function parseArcaneDate(value: string | undefined | null): Date | undefined {
	if (value == null) return undefined;
	const match = ISO_PATTERN.exec(value.trim());
	if (!match) return undefined;
	const [, day, time, fraction, zone] = match;
	const millis = fraction ? `.${fraction.slice(0, 3).padEnd(3, '0')}` : '';
	const normalizedZone =
		zone === undefined || zone === 'z' || zone === 'Z'
			? 'Z'
			: zone.includes(':')
				? zone
				: `${zone.slice(0, 3)}:${zone.slice(3)}`;
	const parsed = Date.parse(`${day}T${time}${millis}${normalizedZone}`);
	return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

/** `parseArcaneDate` that throws, for fields Swift decodes as non-optional `Date`. */
export function requireArcaneDate(value: string): Date {
	const date = parseArcaneDate(value);
	if (!date) throw new Error(`Invalid ISO8601 date: ${value}`);
	return date;
}

/** Swift `.iso8601` encoding: `2024-01-02T03:04:05Z` (UTC, no fractional seconds). */
export function formatArcaneDate(date: Date): ISODateString {
	return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Seconds until `value` (Swift `date.timeIntervalSinceNow`). */
export function timeIntervalSinceNow(value: ISODateString, now: number = Date.now()): number {
	const date = parseArcaneDate(value);
	return date ? (date.getTime() - now) / 1000 : Number.NEGATIVE_INFINITY;
}
