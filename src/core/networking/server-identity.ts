import { parseURL } from '@/sdk/client/url';

function defaultPort(scheme: string): number | undefined {
	switch (scheme) {
		case 'http':
			return 80;
		case 'https':
			return 443;
		default:
			return undefined;
	}
}

export function canonicalServerOrigin(url: string): string | undefined {
	const parsed = parseURL(url);
	if (!parsed) return undefined;
	const scheme = parsed.scheme.toLowerCase();
	if (scheme !== 'http' && scheme !== 'https') return undefined;
	let host = parsed.host.toLowerCase();
	if (!host) return undefined;
	if (host.endsWith('.')) host = host.slice(0, -1);
	const port = parsed.port ?? (scheme === 'https' ? 443 : 80);
	let path = parsed.path;
	while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
	if (path === '/') path = '';
	return `${scheme}://${host}:${port}${path}`;
}

export function serverCacheIdentity(url: string): string {
	const parsed = parseURL(url);
	if (!parsed || !parsed.scheme || !parsed.host) return url;
	const scheme = parsed.scheme.toLowerCase();
	const host = parsed.host.toLowerCase();
	const authority = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
	const port = parsed.port ?? defaultPort(scheme);
	let path = parsed.path || '/';
	if (!path.startsWith('/')) path = '/' + path;
	if (!path.endsWith('/')) path += '/';
	return port !== undefined
		? `${scheme}://${authority}:${port}${path}`
		: `${scheme}://${authority}${path}`;
}

export function isSameOrigin(lhs: string, rhs: string): boolean {
	const a = parseURL(lhs);
	const b = parseURL(rhs);
	if (!a || !b || !a.host || !b.host) return false;
	const aScheme = a.scheme.toLowerCase();
	const bScheme = b.scheme.toLowerCase();
	if (aScheme !== bScheme) return false;
	const trim = (host: string) => {
		const lower = host.toLowerCase();
		return lower.endsWith('.') ? lower.slice(0, -1) : lower;
	};
	if (trim(a.host) !== trim(b.host)) return false;
	return (a.port ?? defaultPort(aScheme)) === (b.port ?? defaultPort(bScheme));
}

const pathAllowed = /[A-Za-z0-9!$&'()*+,\-.:;=@_~]/;

export function escapedPathComponent(value: string): string {
	let out = '';
	for (const char of value) {
		if (pathAllowed.test(char)) {
			out += char;
		} else {
			for (const byte of new TextEncoder().encode(char)) {
				out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
			}
		}
	}
	return out;
}

export function normalizeServerURLInput(input: string): string | undefined {
	const trimmed = input.trim();
	const lowered = trimmed.toLowerCase();
	const normalized =
		lowered.startsWith('http://') || lowered.startsWith('https://')
			? trimmed
			: `https://${trimmed}`;
	if (/[\s<>"{}|\\^`]/.test(normalized)) return undefined;
	const parsed = parseURL(normalized);
	if (!parsed || !parsed.host) return undefined;
	return normalized;
}

export function hostOf(url: string): string | undefined {
	const host = parseURL(url)?.host;
	if (!host) return undefined;
	return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

export function hostAndPort(url: string): string | undefined {
	const parsed = parseURL(url);
	if (!parsed?.host) return undefined;
	return parsed.port !== undefined ? `${parsed.host}:${parsed.port}` : parsed.host;
}

export function ipv4Octets(value: string): number[] | undefined {
	const parts = value.split('.');
	if (parts.length !== 4) return undefined;
	const octets: number[] = [];
	for (const part of parts) {
		if (!/^\d+$/.test(part)) return undefined;
		const octet = Number(part);
		if (octet < 0 || octet > 255) return undefined;
		octets.push(octet);
	}
	return octets;
}

export function ipv6Bytes(value: string): number[] | undefined {
	if (!value.includes(':') || /[^0-9A-Fa-f:.]/.test(value)) return undefined;
	let head = value;
	let tailV4: number[] = [];
	const lastColon = value.lastIndexOf(':');
	const last = value.slice(lastColon + 1);
	if (last.includes('.')) {
		const octets = ipv4Octets(last);
		if (!octets) return undefined;
		tailV4 = octets;
		head = value.slice(0, lastColon + 1) + '0:0';
	}
	const halves = head.split('::');
	if (halves.length > 2) return undefined;
	const parseGroups = (part: string) => (part === '' ? [] : part.split(':'));
	const left = parseGroups(halves[0] ?? '');
	const right = halves.length === 2 ? parseGroups(halves[1] ?? '') : [];
	const groups =
		halves.length === 2
			? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
			: left;
	if (groups.length !== 8 || (halves.length === 2 && left.length + right.length > 7))
		return undefined;
	const bytes: number[] = [];
	for (const group of groups) {
		if (!/^[0-9A-Fa-f]{1,4}$/.test(group)) return undefined;
		const n = parseInt(group, 16);
		bytes.push(n >> 8, n & 0xff);
	}
	if (tailV4.length === 4) bytes.splice(12, 4, ...tailV4);
	return bytes;
}

export function isIPv6Address(value: string): boolean {
	return ipv6Bytes(value) !== undefined;
}

export function isIPAddress(value: string): boolean {
	return ipv4Octets(value) !== undefined || isIPv6Address(value);
}

function isPrivateIPv4(octets: number[]): boolean {
	const [a = 0, b = 0] = octets;
	if (a === 10 || a === 127 || (a === 169 && b === 254) || (a === 192 && b === 168)) return true;
	return (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127);
}

function isNonPublicIPv4(octets: number[]): boolean {
	if (octets.length !== 4) return true;
	if (isPrivateIPv4(octets)) return true;
	const [a = 0, b = 0, c = 0] = octets;
	if (
		a === 0 ||
		(a === 192 && b === 0 && (c === 0 || c === 2)) ||
		(a === 198 && (b === 18 || b === 19)) ||
		(a === 198 && b === 51 && c === 100) ||
		(a === 203 && b === 0 && c === 113)
	) {
		return true;
	}
	return a >= 224;
}

function isNonPublicIPv6(value: string): boolean {
	const bytes = ipv6Bytes(value);
	if (!bytes) return true;
	if (bytes.every((byte) => byte === 0)) return true;
	const first = bytes[0] ?? 0;
	const second = bytes[1] ?? 0;
	if (
		value === '::1' ||
		first === 0xfc ||
		first === 0xfd ||
		(first === 0xfe && (second & 0xc0) === 0x80)
	)
		return true;
	if (
		first === 0xff ||
		(first === 0x20 && second === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8)
	)
		return true;
	if (bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff) {
		return isNonPublicIPv4(bytes.slice(12, 16));
	}
	return false;
}

export function isPublicIPAddress(value: string): boolean {
	const octets = ipv4Octets(value);
	if (octets) return !isNonPublicIPv4(octets);
	if (isIPv6Address(value)) return !isNonPublicIPv6(value);
	return false;
}
