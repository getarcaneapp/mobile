import { createContext, useContext } from 'react';

export const TabStackGroupContext = createContext<string | undefined>(undefined);

export const ActivityCenterStackContext = createContext(false);

export function useTabStackGroup(fallback = '(more)'): string {
	return useContext(TabStackGroupContext) ?? fallback;
}

export function useIsInActivityCenterStack(): boolean {
	return useContext(ActivityCenterStackContext);
}
