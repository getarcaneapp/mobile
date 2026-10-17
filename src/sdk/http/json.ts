/**
 * JSON helpers shared by the transport (Swift `ArcaneJSON`).
 *
 * `parseArcaneJSON` removes `null`-valued object properties so a Swift
 * `T?` property maps to an optional TS property (`field?: T`) whether the
 * server omitted it or sent `null`. `null` array elements are preserved.
 */
export function parseArcaneJSON(text: string): unknown {
	return JSON.parse(text, function (this: unknown, _key: string, value: unknown) {
		if (value === null && !Array.isArray(this)) return undefined;
		return value;
	});
}

/** Swift `JSONEncoder` equivalent: `undefined` properties are omitted. */
export function encodeArcaneJSON(value: unknown): string {
	return JSON.stringify(value);
}

const textDecoder = new TextDecoder();

export function decodeUTF8(bytes: Uint8Array): string {
	return textDecoder.decode(bytes);
}

const textEncoder = new TextEncoder();

export function encodeUTF8(text: string): Uint8Array {
	return textEncoder.encode(text);
}
