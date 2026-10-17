import type { EnvironmentID } from '@/sdk/client/environment';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';

export function hasPermission(perm: string, envID?: EnvironmentID | null): boolean {
	const manager = useClientManager.getState();
	const user = manager.currentUser;
	if (!user) return false;
	const environment = envID === undefined ? manager.activeEnvironmentID : (envID ?? undefined);
	return User.hasPermission(user, perm, environment);
}

export function usePermission(perm: string, envID?: EnvironmentID): boolean {
	useClientManager((s) => s.accessGeneration);
	useClientManager((s) => s.currentUser);
	useClientManager((s) => s.activeEnvironmentID);
	return hasPermission(perm, envID);
}
