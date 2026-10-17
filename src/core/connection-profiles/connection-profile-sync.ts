/**
 * Pure profile validation and merge rules. Port of `ConnectionProfileSync`,
 * `ConnectionProfileRecord`/`Payload`, and the credential record types in
 * ConnectionProfileStore.swift / ConnectionCredentialStore.swift.
 *
 * Records are merged independently so concurrent edits do not replace
 * unrelated profiles. Deleted records remain as tombstones. This build keeps
 * profiles on-device (no iCloud Keychain), but the payload and merge rules are
 * unchanged so a future sync backend can reuse them.
 */
import { parseURL } from '@/sdk/client/url';

export interface ConnectionProfile {
	/** Uppercase UUID string (Swift `UUID.uuidString`). */
	id: string;
	name: string;
	serverURL: string;
	/** Milliseconds since 1970 (the Swift keychain encoding). */
	modifiedAt: number;
}

export interface ConnectionProfileRecord {
	id: string;
	name: string;
	serverURL: string;
	modifiedAt: number;
	revision: string;
	isDeleted: boolean;
}

export interface ConnectionProfilePayload {
	version: number;
	records: ConnectionProfileRecord[];
}

export const ConnectionProfilePayload = {
	schemaVersion: 1,
	get empty(): ConnectionProfilePayload {
		return { version: 1, records: [] };
	},
	equals(a: ConnectionProfilePayload, b: ConnectionProfilePayload): boolean {
		if (a.version !== b.version || a.records.length !== b.records.length) return false;
		return a.records.every((record, index) => recordEquals(record, b.records[index]));
	}
} as const;

function recordEquals(a: ConnectionProfileRecord, b: ConnectionProfileRecord | undefined): boolean {
	return (
		b !== undefined &&
		a.id === b.id &&
		a.name === b.name &&
		a.serverURL === b.serverURL &&
		a.modifiedAt === b.modifiedAt &&
		a.revision === b.revision &&
		a.isDeleted === b.isDeleted
	);
}

export function recordProfile(record: ConnectionProfileRecord): ConnectionProfile | undefined {
	if (record.isDeleted) return undefined;
	return {
		id: record.id,
		name: record.name,
		serverURL: record.serverURL,
		modifiedAt: record.modifiedAt
	};
}

export type ConnectionProfileValidationErrorKind =
	| 'invalidServerURL'
	| 'unsupportedScheme'
	| 'profileLimitReached'
	| 'persistenceFailed';

const profileErrorDescriptions: Record<ConnectionProfileValidationErrorKind, string> = {
	invalidServerURL: 'Enter a valid Arcane server address.',
	unsupportedScheme: 'Connection profiles support HTTP and HTTPS server addresses.',
	profileLimitReached: 'You can save up to 25 connection profiles.',
	persistenceFailed: "The connection profile couldn't be saved."
};

export class ConnectionProfileValidationError extends Error {
	readonly kind: ConnectionProfileValidationErrorKind;
	constructor(kind: ConnectionProfileValidationErrorKind) {
		super(profileErrorDescriptions[kind]);
		this.name = 'ConnectionProfileValidationError';
		this.kind = kind;
	}
}

// Characters `URLComponents(string:)` refuses without percent-encoding.
const illegalURLCharacters = /[\s<>"{}|\\^`]/;

function compareIDs(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** Swift `localizedCaseInsensitiveCompare`. */
function localizedCaseInsensitiveCompare(a: string, b: string): number {
	return a.localeCompare(b, undefined, { sensitivity: 'accent' });
}

export const ConnectionProfileSync = {
	maximumActiveProfiles: 25,

	normalizedServerURL(rawValue: string): string {
		const trimmed = rawValue.trim();
		if (!trimmed || Array.from(trimmed).length > 2_048) {
			throw new ConnectionProfileValidationError('invalidServerURL');
		}
		const separator = trimmed.indexOf('://');
		if (separator >= 0) {
			const scheme = trimmed.slice(0, separator).toLowerCase();
			if (scheme !== 'http' && scheme !== 'https')
				throw new ConnectionProfileValidationError('unsupportedScheme');
		}
		const value = separator >= 0 ? trimmed : `https://${trimmed}`;
		if (illegalURLCharacters.test(value))
			throw new ConnectionProfileValidationError('invalidServerURL');
		const components = parseURL(value);
		const scheme = components?.scheme.toLowerCase();
		const host = components?.host.trim();
		if (!components || (scheme !== 'http' && scheme !== 'https') || !host) {
			throw new ConnectionProfileValidationError('invalidServerURL');
		}
		const port =
			(scheme === 'https' && components.port === 443) ||
			(scheme === 'http' && components.port === 80)
				? undefined
				: components.port;
		let path = components.path;
		while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
		if (path === '/') path = '';
		return `${scheme}://${host.toLowerCase()}${port !== undefined ? `:${port}` : ''}${path}`;
	},

	defaultName(serverURL: string): string {
		const parsed = parseURL(serverURL);
		if (!parsed?.host) return 'Arcane Server';
		return parsed.port !== undefined ? `${parsed.host}:${parsed.port}` : parsed.host;
	},

	sanitizedName(rawValue: string, serverURL: string): string {
		let prepared = '';
		for (const scalar of rawValue) {
			if (/\s/u.test(scalar)) prepared += ' ';
			else if (!/\p{Cc}/u.test(scalar)) prepared += scalar;
		}
		const collapsed = prepared.split(/\s+/u).filter(Boolean).join(' ');
		const fallback = ConnectionProfileSync.defaultName(serverURL);
		return Array.from(collapsed || fallback)
			.slice(0, 60)
			.join('');
	},

	merge(
		local: ConnectionProfilePayload,
		remote: ConnectionProfilePayload
	): ConnectionProfilePayload {
		const recordsByID = new Map<string, ConnectionProfileRecord>();
		for (const record of [...local.records, ...remote.records]) {
			const existing = recordsByID.get(record.id);
			recordsByID.set(record.id, existing ? preferred(existing, record) : record);
		}

		// Canonicalize old payloads and retire malformed records without ever
		// exposing unsafe URL components.
		for (const [id, record] of recordsByID) {
			if (record.isDeleted) continue;
			let normalized: string;
			try {
				normalized = ConnectionProfileSync.normalizedServerURL(record.serverURL);
			} catch {
				recordsByID.set(id, { ...record, isDeleted: true });
				continue;
			}
			const safeName = ConnectionProfileSync.sanitizedName(record.name, normalized);
			if (normalized !== record.serverURL || safeName !== record.name) {
				recordsByID.set(id, { ...record, name: safeName, serverURL: normalized });
			}
		}

		// Two devices can add the same server with different IDs. Keep the newest
		// and tombstone its duplicate so it can't reappear later.
		const active = [...recordsByID.values()].filter((r) => !r.isDeleted).sort(byNewest);
		const winnerByURL = new Map<string, ConnectionProfileRecord>();
		for (const record of active) {
			const winner = winnerByURL.get(record.serverURL);
			if (winner) {
				recordsByID.set(record.id, {
					...record,
					modifiedAt: winner.modifiedAt,
					revision: winner.revision,
					isDeleted: true
				});
			} else {
				winnerByURL.set(record.serverURL, record);
			}
		}

		const retained = [...recordsByID.values()].filter((r) => !r.isDeleted).sort(byNewest);
		for (const record of retained.slice(ConnectionProfileSync.maximumActiveProfiles)) {
			recordsByID.set(record.id, { ...record, isDeleted: true });
		}

		return {
			version: Math.max(local.version, remote.version, ConnectionProfilePayload.schemaVersion),
			records: [...recordsByID.values()].sort((a, b) => compareIDs(a.id, b.id))
		};
	},

	activeProfiles(payload: ConnectionProfilePayload): ConnectionProfile[] {
		return payload.records
			.map(recordProfile)
			.filter((profile): profile is ConnectionProfile => profile !== undefined)
			.sort((a, b) => {
				const comparison = localizedCaseInsensitiveCompare(a.name, b.name);
				return comparison !== 0
					? comparison
					: localizedCaseInsensitiveCompare(a.serverURL, b.serverURL);
			});
	}
} as const;

function isNewer(lhs: ConnectionProfileRecord, rhs: ConnectionProfileRecord): boolean {
	if (lhs.modifiedAt !== rhs.modifiedAt) return lhs.modifiedAt > rhs.modifiedAt;
	if (lhs.revision !== rhs.revision) return lhs.revision > rhs.revision;
	return lhs.id > rhs.id;
}

function byNewest(a: ConnectionProfileRecord, b: ConnectionProfileRecord): number {
	return isNewer(a, b) ? -1 : isNewer(b, a) ? 1 : 0;
}

function preferred(
	lhs: ConnectionProfileRecord,
	rhs: ConnectionProfileRecord
): ConnectionProfileRecord {
	if (isNewer(lhs, rhs)) return lhs;
	if (isNewer(rhs, lhs)) return rhs;
	if (lhs.isDeleted !== rhs.isDeleted) return lhs.isDeleted ? lhs : rhs;
	return lhs.id <= rhs.id ? lhs : rhs;
}

/** Defensive decode of a stored payload (unknown JSON). */
export function decodeConnectionProfilePayload(raw: unknown): ConnectionProfilePayload {
	if (typeof raw !== 'object' || raw === null) return ConnectionProfilePayload.empty;
	const object = raw as { version?: unknown; records?: unknown };
	const records = Array.isArray(object.records) ? object.records : [];
	return {
		version:
			typeof object.version === 'number' ? object.version : ConnectionProfilePayload.schemaVersion,
		records: records.flatMap((entry): ConnectionProfileRecord[] => {
			if (typeof entry !== 'object' || entry === null) return [];
			const r = entry as Record<string, unknown>;
			if (
				typeof r.id !== 'string' ||
				typeof r.name !== 'string' ||
				typeof r.serverURL !== 'string' ||
				typeof r.modifiedAt !== 'number' ||
				typeof r.revision !== 'string' ||
				typeof r.isDeleted !== 'boolean'
			) {
				return [];
			}
			return [
				{
					id: r.id,
					name: r.name,
					serverURL: r.serverURL,
					modifiedAt: r.modifiedAt,
					revision: r.revision,
					isDeleted: r.isDeleted
				}
			];
		})
	};
}

// MARK: - Credentials

export type ConnectionCredentialValidationErrorKind =
	| 'emptyUsername'
	| 'emptyPassword'
	| 'credentialTooLarge'
	| 'invalidProfile'
	| 'persistenceFailed';

const credentialErrorDescriptions: Record<ConnectionCredentialValidationErrorKind, string> = {
	emptyUsername: 'Enter a username or clear both sign-in fields.',
	emptyPassword: 'Enter a password or clear both sign-in fields.',
	credentialTooLarge: 'The username or password is too large to save.',
	invalidProfile: "The connection profile isn't valid for a saved sign-in.",
	persistenceFailed: "The sign-in couldn't be updated on this device."
};

export class ConnectionCredentialValidationError extends Error {
	readonly kind: ConnectionCredentialValidationErrorKind;
	constructor(kind: ConnectionCredentialValidationErrorKind) {
		super(credentialErrorDescriptions[kind]);
		this.name = 'ConnectionCredentialValidationError';
		this.kind = kind;
	}
}

const utf8Length = (value: string) => new TextEncoder().encode(value).byteLength;

/** Port of `SyncedConnectionCredential` (kept on-device in this build). */
export interface SavedConnectionCredential {
	readonly username: string;
	readonly password: string;
}

export const SavedConnectionCredential = {
	make(username: string, password: string): SavedConnectionCredential {
		if (!username) throw new ConnectionCredentialValidationError('emptyUsername');
		if (!password) throw new ConnectionCredentialValidationError('emptyPassword');
		if (
			utf8Length(username) > ConnectionCredentialRecord.maximumUsernameBytes ||
			utf8Length(password) > ConnectionCredentialRecord.maximumPasswordBytes
		) {
			throw new ConnectionCredentialValidationError('credentialTooLarge');
		}
		return { username, password };
	},

	/** Empty fields mean a connection-only profile; a partial sign-in is rejected. */
	optional(username: string, password: string): SavedConnectionCredential | undefined {
		if (!username && !password) return undefined;
		return SavedConnectionCredential.make(username, password);
	}
} as const;

export interface ConnectionCredentialRecord {
	version: number;
	profileID: string;
	serverURL: string;
	username: string;
	password: string;
}

export const ConnectionCredentialRecord = {
	schemaVersion: 1,
	maximumUsernameBytes: 1_024,
	maximumPasswordBytes: 16_384,

	make(profile: ConnectionProfile, username: string, password: string): ConnectionCredentialRecord {
		const credential = SavedConnectionCredential.make(username, password);
		let serverURL: string;
		try {
			serverURL = ConnectionProfileSync.normalizedServerURL(profile.serverURL);
		} catch {
			throw new ConnectionCredentialValidationError('invalidProfile');
		}
		return {
			version: ConnectionCredentialRecord.schemaVersion,
			profileID: profile.id,
			serverURL,
			username: credential.username,
			password: credential.password
		};
	},

	credential(
		record: ConnectionCredentialRecord,
		profile: ConnectionProfile
	): SavedConnectionCredential | undefined {
		if (
			record.version !== ConnectionCredentialRecord.schemaVersion ||
			record.profileID !== profile.id
		)
			return undefined;
		try {
			if (ConnectionProfileSync.normalizedServerURL(profile.serverURL) !== record.serverURL)
				return undefined;
			return SavedConnectionCredential.make(record.username, record.password);
		} catch {
			return undefined;
		}
	},

	/** Port of `ConnectionCredentialKeychainStore.decode` validation. Throws on bad data. */
	decode(raw: unknown): ConnectionCredentialRecord {
		const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
		const valid =
			r.version === ConnectionCredentialRecord.schemaVersion &&
			typeof r.profileID === 'string' &&
			typeof r.serverURL === 'string' &&
			typeof r.username === 'string' &&
			typeof r.password === 'string' &&
			r.username !== '' &&
			r.password !== '' &&
			utf8Length(r.username) <= ConnectionCredentialRecord.maximumUsernameBytes &&
			utf8Length(r.password) <= ConnectionCredentialRecord.maximumPasswordBytes;
		if (!valid) throw new ConnectionCredentialValidationError('persistenceFailed');
		let normalized: string | undefined;
		try {
			normalized = ConnectionProfileSync.normalizedServerURL(r.serverURL as string);
		} catch {
			normalized = undefined;
		}
		if (normalized !== r.serverURL)
			throw new ConnectionCredentialValidationError('persistenceFailed');
		return r as unknown as ConnectionCredentialRecord;
	}
} as const;
