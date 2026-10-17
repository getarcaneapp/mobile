/**
 * Port of Utils/EnvironmentSecretDetector.swift: `ParsedEnvironmentVariable`
 * plus the heuristics that flag a `NAME=value` pair as a potential secret so
 * its value is blurred until revealed. Pure TS.
 */

export interface ParsedEnvironmentVariable {
	rawValue: string;
	name: string;
	value?: string;
	isPotentialSecret: boolean;
}

export function parseEnvironmentVariable(rawValue: string): ParsedEnvironmentVariable {
	const separator = rawValue.indexOf('=');
	if (separator < 0) return { rawValue, name: rawValue, isPotentialSecret: false };
	const name = rawValue.slice(0, separator);
	const value = rawValue.slice(separator + 1);
	return {
		rawValue,
		name,
		value,
		isPotentialSecret: EnvironmentSecretDetector.isPotentialSecret(name, value)
	};
}

const metadataSuffixes = new Set([
	'ALGORITHM',
	'ARN',
	'DISABLED',
	'ENABLED',
	'ENDPOINT',
	'EXPIRATION',
	'EXPIRES',
	'EXPIRY',
	'FILE',
	'FORMAT',
	'HOST',
	'ID',
	'LENGTH',
	'METHOD',
	'MODE',
	'NAME',
	'PATH',
	'PORT',
	'PROVIDER',
	'REQUIRED',
	'TTL',
	'TYPE',
	'URI',
	'URL',
	'VERSION'
]);

const strongSecretWords = new Set([
	'AUTH',
	'AUTHORIZATION',
	'CREDENTIAL',
	'CREDENTIALS',
	'PASSCODE',
	'PASSPHRASE',
	'PASSWD',
	'PASSWORD',
	'SECRET',
	'SIG',
	'SIGNATURE',
	'TOKEN'
]);

const keyQualifiers = new Set([
	'ACCESS',
	'API',
	'APP',
	'APPLICATION',
	'AUTH',
	'ENCRYPTION',
	'MASTER',
	'PRIVATE',
	'SECRET',
	'SIGNING',
	'SSH'
]);

const compactSecretNames = new Set([
	'APIKEY',
	'APPKEY',
	'AUTHTOKEN',
	'CLIENTSECRET',
	'PRIVATEKEY',
	'REFRESHTOKEN'
]);

const secretValuePrefixes = [
	'aiza',
	'bearer ',
	'basic ',
	'gho_',
	'ghp_',
	'ghr_',
	'ghs_',
	'ghu_',
	'github_pat_',
	'glpat-',
	'npm_',
	'pypi-',
	'rk_live_',
	'rk_test_',
	'sk_live_',
	'sk_test_',
	'xox'
];

function nameLooksSensitive(name: string): boolean {
	const words = name
		.toUpperCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word !== '');
	const suffix = words[words.length - 1];
	if (suffix === undefined) return false;
	if (compactSecretNames.has(words.join(''))) return true;
	if (words.includes('WEBHOOK') && (suffix === 'URL' || suffix === 'URI')) return true;
	if (metadataSuffixes.has(suffix)) return false;
	if (words.some((word) => strongSecretWords.has(word))) return true;
	if (suffix !== 'KEY') return false;
	if (words.includes('PUBLIC') && !words.includes('PRIVATE')) return false;
	return words.length === 1 || words.some((word) => keyQualifiers.has(word));
}

function looksLikeJSONWebToken(value: string): boolean {
	const segments = value.split('.');
	if (segments.length !== 3 || Array.from(value).length < 40 || !segments[0]!.startsWith('eyJ'))
		return false;
	return segments.every((segment) => segment !== '' && /^[A-Za-z0-9_-]+$/.test(segment));
}

function containsURLCredential(value: string): boolean {
	if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return false;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	if (url.password !== '') return true;
	for (const [name, itemValue] of url.searchParams) {
		if (itemValue !== '' && nameLooksSensitive(name)) return true;
	}
	return false;
}

function containsCredentialAssignment(value: string): boolean {
	return (
		value
			// oxlint-disable-next-line no-control-regex -- VT/FF are part of Swift CharacterSet.newlines.
			.split(/[;&,\n\r\u000B\u000C\u0085\u2028\u2029]/)
			.filter((field) => field !== '')
			.some((field) => {
				const separator = field.indexOf('=');
				if (separator < 0) return false;
				const fieldName = field.slice(0, separator).trim();
				const fieldValue = field.slice(separator + 1).trim();
				return fieldValue !== '' && nameLooksSensitive(fieldName);
			})
	);
}

function valueLooksSensitive(value: string): boolean {
	const lower = value.toLowerCase();
	if (secretValuePrefixes.some((prefix) => lower.startsWith(prefix))) return true;
	const upper = value.toUpperCase();
	if (upper.includes('-----BEGIN ') && upper.includes('PRIVATE KEY-----')) return true;
	return (
		looksLikeJSONWebToken(value) ||
		containsURLCredential(value) ||
		containsCredentialAssignment(value)
	);
}

function removingMatchingQuotes(value: string): string {
	const characters = Array.from(value);
	const first = characters[0];
	const last = characters[characters.length - 1];
	if (
		characters.length >= 2 &&
		((first === '"' && last === '"') || (first === "'" && last === "'"))
	) {
		return characters.slice(1, -1).join('');
	}
	return value;
}

export const EnvironmentSecretDetector = {
	isPotentialSecret(name: string, value: string): boolean {
		const candidate = removingMatchingQuotes(value.trim());
		if (candidate === '') return false;
		return nameLooksSensitive(name) || valueLooksSensitive(candidate);
	}
} as const;
