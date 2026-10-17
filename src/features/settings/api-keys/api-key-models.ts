/**
 * Port of APIKeyModels.swift plus the helpers APIKeysView.swift shares with
 * the detail and form screens (`APIKeyOwnerText`, `APIKeyDateText`,
 * `APIKeySortField`). Pure TS.
 */
import { formatDate } from '@/core/date-formatting';
import { cachedClient } from '@/core/networking/use-cached-client';
import { parseArcaneDate, type ISODateString } from '@/sdk/models/base/date';
import type { APIKey } from '@/sdk/models/apiKey/APIKey';
import type { ApiKeyPermissionGrant } from '@/sdk/models/role/ApiKeyPermissionGrant';
import type { User } from '@/sdk/models/user/User';
import { relativeTimeFormat } from '@/core/relative-time';

/**
 * API-key fields added by Arcane v2 that are not yet surfaced by the SDK's
 * `APIKey` model. Optional so the detail screen decodes v1 and v2 responses.
 */
export interface APIKeyServerMetadata {
	kind?: string;
	isBootstrap?: boolean;
	permissions?: ApiKeyPermissionGrant[];
}

/**
 * Shared create/update payload. `permissions` is omitted for v1 and personal
 * keys, while v2 scoped keys send the same global grants as Arcane's web UI.
 */
export interface APIKeyMutationRequest {
	name: string;
	description?: string;
	expiresAt?: ISODateString;
	permissions?: ApiKeyPermissionGrant[];
}

/** One-time secret presentation used after creating or rotating a key. */
export interface APIKeySecretPresentation {
	key: string;
	navigationTitle: string;
	heading: string;
	message: string;
	warning?: string;
}

export const APIKeySecretPresentation = {
	created(key: string): APIKeySecretPresentation {
		return {
			key,
			navigationTitle: 'API Key Created',
			heading: 'Save Your API Key',
			message: 'This key will only be shown once. Make sure to save it somewhere safe.'
		};
	},

	rotated(key: string, oldKeyRevoked: boolean): APIKeySecretPresentation {
		return {
			key,
			navigationTitle: 'API Key Rotated',
			heading: 'Save Your Rotated Key',
			message:
				'This replacement key will only be shown once. Update anything that used the old key.',
			warning: oldKeyRevoked
				? undefined
				: 'The replacement was created, but the old key could not be revoked. Both keys may still be active.'
		};
	}
} as const;

export type APIKeySortField = 'name' | 'expiresAt' | 'lastUsedAt';

export const apiKeySortFields: { value: APIKeySortField; title: string }[] = [
	{ value: 'name', title: 'Name' },
	{ value: 'expiresAt', title: 'Expiration' },
	{ value: 'lastUsedAt', title: 'Last Used' }
];

/** `apiKey.expiresAt.map { $0 <= Date() } == true`. */
export function apiKeyIsExpired(apiKey: Pick<APIKey, 'expiresAt'>): boolean {
	const date = parseArcaneDate(apiKey.expiresAt);
	return date !== undefined && date.getTime() <= Date.now();
}

/** Swift `User.displayUsername` (Models.swift). */
export function displayUsername(user: Pick<User, 'displayName' | 'username'>): string {
	return user.displayName ? user.displayName : user.username;
}

/** Port of `APIKeyOwnerText`. */
export const APIKeyOwnerText = {
	title(user: User | undefined, userID: string | undefined): string {
		if (user) return displayUsername(user);
		if (!userID) return 'System managed';
		return `User ${userID.slice(0, 8)}`;
	},

	detail(user: User | undefined, userID: string | undefined): string {
		if (user) {
			const display = displayUsername(user);
			if (display === user.username) return user.username;
			return `${display} (@${user.username})`;
		}
		if (!userID) return 'System managed';
		return userID;
	}
} as const;

/** `Date.formatted(.relative(presentation: .named))`. */
function relativeNamed(date: Date): string {
	const seconds = Math.round((date.getTime() - Date.now()) / 1000);
	const format = relativeTimeFormat();
	const abs = Math.abs(seconds);
	if (abs < 60) return format.format(seconds, 'second');
	if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
	if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour');
	if (abs < 86400 * 7) return format.format(Math.round(seconds / 86400), 'day');
	if (abs < 86400 * 30) return format.format(Math.round(seconds / (86400 * 7)), 'week');
	if (abs < 86400 * 365) return format.format(Math.round(seconds / (86400 * 30)), 'month');
	return format.format(Math.round(seconds / (86400 * 365)), 'year');
}

/** Port of `APIKeyDateText`. */
export const APIKeyDateText = {
	expiration(value: ISODateString | undefined): string {
		const date = parseArcaneDate(value);
		if (!date) return 'Never expires';
		return `Expires ${formatDate(date, 'abbreviated', 'omitted')}`;
	},

	lastUsed(value: ISODateString | undefined): string {
		const date = parseArcaneDate(value);
		if (!date) return 'Never';
		return relativeNamed(date);
	},

	/** `date.formatted(date: .abbreviated, time: .shortened)`, or `fallback` when absent. */
	detail(value: ISODateString | undefined, fallback: string): string {
		const date = parseArcaneDate(value);
		return date ? formatDate(date, 'abbreviated', 'shortened') : fallback;
	}
} as const;

/** `cached.invalidateGlobal(paths: ["api-keys", "api-keys/*"])`. */
export function invalidateAPIKeyCache() {
	cachedClient()?.invalidateGlobal(['api-keys', 'api-keys/*']);
}

/** `Calendar.current.date(byAdding: .day, value: 90, to: Date())`. */
export function defaultExpirationDate(): Date {
	const date = new Date();
	date.setDate(date.getDate() + 90);
	return date;
}

/** Route payloads handed to the pushed API-key screens. */
export type APIKeyDetailPayload = {
	apiKey: APIKey;
	assignedUser?: User;
	onChanged: () => Promise<void>;
};

export type CreateAPIKeyPayload = { onCreated: (key: string) => void };

export type EditAPIKeyPayload = {
	apiKey: APIKey;
	metadata?: APIKeyServerMetadata;
	onSaved: (updated: APIKey) => Promise<void>;
};

export type APIKeySecretPayload = { presentation: APIKeySecretPresentation };
