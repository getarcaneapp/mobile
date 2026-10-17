const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const LOOKUP: Record<string, number> = Object.fromEntries(
	Array.from(ALPHABET, (char, index) => [char, index])
);

export function base64URLEncode(bytes: Uint8Array): string {
	let output = '';
	for (let i = 0; i < bytes.length; i += 3) {
		const b0 = bytes[i] ?? 0;
		const b1 = bytes[i + 1] ?? 0;
		const b2 = bytes[i + 2] ?? 0;
		const triple = (b0 << 16) | (b1 << 8) | b2;
		const remaining = bytes.length - i;
		output += ALPHABET[(triple >> 18) & 63];
		output += ALPHABET[(triple >> 12) & 63];
		if (remaining > 1) output += ALPHABET[(triple >> 6) & 63];
		if (remaining > 2) output += ALPHABET[triple & 63];
	}
	return output;
}

export function base64URLDecode(value: string): Uint8Array | undefined {
	if (value.length % 4 === 1) return undefined;
	const output = new Uint8Array(Math.floor((value.length * 3) / 4));
	let buffer = 0;
	let bits = 0;
	let index = 0;
	for (const char of value) {
		const sextet = LOOKUP[char];
		if (sextet === undefined) return undefined;
		buffer = ((buffer << 6) | sextet) & 0xffffff;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			output[index++] = (buffer >> bits) & 0xff;
		}
	}
	return output;
}
