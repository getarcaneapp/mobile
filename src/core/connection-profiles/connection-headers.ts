import {
	ConnectionProfileSync,
	type ConnectionProfile
} from '@/core/connection-profiles/connection-profile-sync';
import { ProxyRequestSupport } from '@/sdk/client/proxyRequestSupport';

export interface ConnectionHeader {
	readonly name: string;
	readonly value: string;
}

export type ConnectionHeaderPreset = { id: string; title: string; names: readonly string[] };

export const connectionHeaderPresets: readonly ConnectionHeaderPreset[] = [
	{
		id: 'cloudflare',
		title: 'Cloudflare Access',
		names: ['CF-Access-Client-Id', 'CF-Access-Client-Secret']
	},
	{ id: 'pangolin', title: 'Pangolin', names: ['P-Access-Token-Id', 'P-Access-Token'] }
];

export type ConnectionHeaderValidationErrorKind =
	| 'emptyName'
	| 'emptyValue'
	| 'invalidName'
	| 'reservedName'
	| 'duplicateName'
	| 'invalidValue'
	| 'valueTooLarge'
	| 'tooManyHeaders'
	| 'invalidProfile'
	| 'persistenceFailed';

function headerErrorDescription(kind: ConnectionHeaderValidationErrorKind, name: string): string {
	switch (kind) {
		case 'emptyName':
			return 'Enter a name for each header or remove it.';
		case 'emptyValue':
			return `Enter a value for ${name} or remove it.`;
		case 'invalidName':
			return `${name} isn't a valid header name.`;
		case 'reservedName':
			return `${name} is set by Arcane and can't be a custom header.`;
		case 'duplicateName':
			return `${name} is listed more than once.`;
		case 'invalidValue':
			return `The value for ${name} can't contain line breaks.`;
		case 'valueTooLarge':
			return `The value for ${name} is too large to save.`;
		case 'tooManyHeaders':
			return `You can add up to ${ConnectionHeaders.maximumCount} custom headers.`;
		case 'invalidProfile':
			return "The connection profile isn't valid for custom headers.";
		case 'persistenceFailed':
			return "The custom headers couldn't be updated on this device.";
	}
}

export class ConnectionHeaderValidationError extends Error {
	readonly kind: ConnectionHeaderValidationErrorKind;
	constructor(kind: ConnectionHeaderValidationErrorKind, name = '') {
		super(headerErrorDescription(kind, name));
		this.name = 'ConnectionHeaderValidationError';
		this.kind = kind;
	}
}

const utf8Length = (value: string) => new TextEncoder().encode(value).byteLength;
const headerNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export const ConnectionHeaders = {
	maximumCount: 10,
	maximumNameLength: 128,
	maximumValueBytes: 4_096,

	make(drafts: readonly ConnectionHeader[]): ConnectionHeader[] {
		const headers: ConnectionHeader[] = [];
		const seen = new Set<string>();
		for (const draft of drafts) {
			const name = draft.name.trim();
			const value = draft.value.trim();
			if (!name && !value) continue;
			if (!name) throw new ConnectionHeaderValidationError('emptyName');
			if (!headerNamePattern.test(name) || name.length > ConnectionHeaders.maximumNameLength)
				throw new ConnectionHeaderValidationError('invalidName', name);
			if (!value) throw new ConnectionHeaderValidationError('emptyValue', name);
			if (value.includes('\r') || value.includes('\n'))
				throw new ConnectionHeaderValidationError('invalidValue', name);
			if (utf8Length(value) > ConnectionHeaders.maximumValueBytes)
				throw new ConnectionHeaderValidationError('valueTooLarge', name);
			if (!ProxyRequestSupport.isAllowed(name, value))
				throw new ConnectionHeaderValidationError('reservedName', name);
			const key = name.toLowerCase();
			if (seen.has(key)) throw new ConnectionHeaderValidationError('duplicateName', name);
			seen.add(key);
			headers.push({ name, value });
		}
		if (headers.length > ConnectionHeaders.maximumCount)
			throw new ConnectionHeaderValidationError('tooManyHeaders');
		return headers;
	},

	equals(a: readonly ConnectionHeader[], b: readonly ConnectionHeader[]): boolean {
		return (
			a.length === b.length &&
			a.every((header, index) => {
				const other = b[index];
				return other !== undefined && header.name === other.name && header.value === other.value;
			})
		);
	},

	record(headers: readonly ConnectionHeader[]): Record<string, string> {
		const result: Record<string, string> = {};
		for (const header of headers) result[header.name] = header.value;
		return result;
	}
} as const;

export interface ConnectionHeadersRecord {
	version: number;
	profileID: string;
	serverURL: string;
	headers: ConnectionHeader[];
}

export const ConnectionHeadersRecord = {
	schemaVersion: 1,

	make(profile: ConnectionProfile, drafts: readonly ConnectionHeader[]): ConnectionHeadersRecord {
		const headers = ConnectionHeaders.make(drafts);
		let serverURL: string;
		try {
			serverURL = ConnectionProfileSync.normalizedServerURL(profile.serverURL);
		} catch {
			throw new ConnectionHeaderValidationError('invalidProfile');
		}
		return {
			version: ConnectionHeadersRecord.schemaVersion,
			profileID: profile.id,
			serverURL,
			headers
		};
	},

	headers(
		record: ConnectionHeadersRecord,
		profile: ConnectionProfile
	): ConnectionHeader[] | undefined {
		if (record.version !== ConnectionHeadersRecord.schemaVersion || record.profileID !== profile.id)
			return undefined;
		try {
			if (ConnectionProfileSync.normalizedServerURL(profile.serverURL) !== record.serverURL)
				return undefined;
			const headers = ConnectionHeaders.make(record.headers);
			return headers.length > 0 ? headers : undefined;
		} catch {
			return undefined;
		}
	},

	equals(a: ConnectionHeadersRecord | undefined, b: ConnectionHeadersRecord): boolean {
		return (
			a !== undefined &&
			a.serverURL === b.serverURL &&
			ConnectionHeaders.equals(a.headers, b.headers)
		);
	},

	decode(raw: unknown): ConnectionHeadersRecord {
		const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
		const entries = Array.isArray(r.headers) ? r.headers : undefined;
		if (
			r.version !== ConnectionHeadersRecord.schemaVersion ||
			typeof r.profileID !== 'string' ||
			typeof r.serverURL !== 'string' ||
			entries === undefined
		)
			throw new ConnectionHeaderValidationError('persistenceFailed');
		const drafts = entries.map((entry): ConnectionHeader => {
			const e = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<
				string,
				unknown
			>;
			if (typeof e.name !== 'string' || typeof e.value !== 'string')
				throw new ConnectionHeaderValidationError('persistenceFailed');
			return { name: e.name, value: e.value };
		});
		let headers: ConnectionHeader[];
		let normalized: string | undefined;
		try {
			headers = ConnectionHeaders.make(drafts);
			normalized = ConnectionProfileSync.normalizedServerURL(r.serverURL);
		} catch {
			throw new ConnectionHeaderValidationError('persistenceFailed');
		}
		if (normalized !== r.serverURL || headers.length === 0)
			throw new ConnectionHeaderValidationError('persistenceFailed');
		return {
			version: ConnectionHeadersRecord.schemaVersion,
			profileID: r.profileID,
			serverURL: r.serverURL,
			headers
		};
	}
} as const;
