function stripNullProperties(value: unknown): void {
	if (typeof value !== 'object' || value === null) return;
	if (Array.isArray(value)) {
		for (const element of value) stripNullProperties(element);
		return;
	}
	const record = value as Record<string, unknown>;
	for (const key in record) {
		const property = record[key];
		if (property === null) delete record[key];
		else if (typeof property === 'object') stripNullProperties(property);
	}
}

export function parseArcaneJSON(text: string): unknown {
	const value: unknown = JSON.parse(text);
	if (value === null) return undefined;
	if (text.includes('null')) stripNullProperties(value);
	return value;
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
