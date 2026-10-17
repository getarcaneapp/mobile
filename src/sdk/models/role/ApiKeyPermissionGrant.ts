/** Port of Models/Role/ApiKeyPermissionGrant.swift. */

/**
 * One permission grant on an API key, optionally scoped to a single
 * environment. Used by the v2 API-key create/update flow; API keys carry
 * independent permission sets (not inherited from the owner). When an API
 * key is created, the server validates that the caller holds every
 * permission being granted.
 */
export interface ApiKeyPermissionGrant {
	permission: string;
	environmentId?: string;
}
