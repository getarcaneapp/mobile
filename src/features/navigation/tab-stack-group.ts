import { useSegments } from 'expo-router';
import { createContext, useContext } from 'react';

/**
 * The route group (`"(more)"`, `"(dashboard)"`, …) of the tab stack a screen
 * lives in, provided by the shared tab-stack layout from its `segment` prop.
 */
export const TabStackGroupContext = createContext<string | undefined>(undefined);

/**
 * The tab stack group to push onto. Screens inside a tab stack get their own
 * stack's group, so a push lands on the presenting stack even while a root
 * sheet (whose segments name no tab) is up or just closing. Outside a tab
 * stack it falls back to the focused route's group, then More.
 */
export function useTabStackGroup(): string {
	const group = useContext(TabStackGroupContext);
	const segments = useSegments() as string[];
	return (
		group ?? segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(more)'
	);
}
