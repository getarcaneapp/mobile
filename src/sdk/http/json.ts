export function parseArcaneJSON(text: string): unknown {
	return JSON.parse(text, function (this: unknown, _key: string, value: unknown) {
		if (value === null && !Array.isArray(this)) return undefined;
		return value;
	});
}

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
