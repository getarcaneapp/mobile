import { useSegments } from 'expo-router';
import { createContext, useContext } from 'react';

export const TabStackGroupContext = createContext<string | undefined>(undefined);

export function useTabStackGroup(): string {
	const group = useContext(TabStackGroupContext);
	const segments = useSegments() as string[];
	return (
		group ?? segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(more)'
	);
}
