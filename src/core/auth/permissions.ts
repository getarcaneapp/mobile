import { useCallback } from 'react';

import type { EnvironmentID } from '@/sdk/client/environment';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';

type PermissionSource = {
	currentUser?: User;
	activeEnvironmentID?: EnvironmentID;
};

function permitted(
	manager: PermissionSource,
	perm: string,
	envID: EnvironmentID | null | undefined
): boolean {
	const user = manager.currentUser;
	if (!user) return false;
	const environment = envID === undefined ? manager.activeEnvironmentID : (envID ?? undefined);
	return User.hasPermission(user, perm, environment);
}

export function hasPermission(perm: string, envID?: EnvironmentID | null): boolean {
	return permitted(useClientManager.getState(), perm, envID);
}

export function usePermission(perm: string, envID?: EnvironmentID | null): boolean {
	useClientManager((s) => s.accessGeneration);
	return useClientManager((s) => permitted(s, perm, envID));
}

export function usePermissionCheck(): (perm: string, envID?: EnvironmentID | null) => boolean {
	const accessGeneration = useClientManager((s) => s.accessGeneration);
	const currentUser = useClientManager((s) => s.currentUser);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	return useCallback(
		(perm: string, envID?: EnvironmentID | null) => {
			void accessGeneration;
			return permitted({ currentUser, activeEnvironmentID }, perm, envID);
		},
		[accessGeneration, currentUser, activeEnvironmentID]
	);
}
