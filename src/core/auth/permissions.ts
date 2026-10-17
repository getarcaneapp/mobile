/**
 * Port of `PermissionsHelper.swift` (`manager.permissions.has(...)`): per-action
 * permission checks against the current user. `User.hasPermission` already
 * falls back to `isAdmin` on v1 servers.
 */
import type { EnvironmentID } from '@/sdk/client/environment';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';

/** Whether the user holds `perm` in `envID` (the active environment when omitted). */
export function hasPermission(perm: string, envID?: EnvironmentID | null): boolean {
	const manager = useClientManager.getState();
	const user = manager.currentUser;
	if (!user) return false;
	const environment = envID === undefined ? manager.activeEnvironmentID : (envID ?? undefined);
	return User.hasPermission(user, perm, environment);
}

/** Reactive `hasPermission`: re-evaluates when the session's access changes. */
export function usePermission(perm: string, envID?: EnvironmentID): boolean {
	useClientManager((s) => s.accessGeneration);
	useClientManager((s) => s.currentUser);
	useClientManager((s) => s.activeEnvironmentID);
	return hasPermission(perm, envID);
}
