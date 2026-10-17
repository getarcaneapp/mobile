import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import {
	parseEnvironmentVariable,
	type ParsedEnvironmentVariable
} from '@/core/environment-secret-detector';

import { containerCache } from './container-routes';

export function useCachedDetails() {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	return containerCache.details(envID, id);
}

export type EnvironmentVariableEntry = { id: number; variable: ParsedEnvironmentVariable };

export function useEnvironmentVariables(vars: readonly string[]) {
	const entries = useMemo(
		() => vars.map((raw, id) => ({ id, variable: parseEnvironmentVariable(raw) })),
		[vars]
	);
	const [searchText, setSearchText] = useState('');
	const [revealReset, setRevealReset] = useState(0);
	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) => {
			if (state !== 'active') setRevealReset((n) => n + 1);
		});
		return () => subscription.remove();
	}, []);
	const displayedEntries = useMemo(() => {
		const query = searchText.trim().toLowerCase();
		if (query === '') return entries;
		return entries.filter(({ variable }) => {
			if (variable.name.toLowerCase().includes(query)) return true;
			if (
				!variable.isPotentialSecret &&
				variable.value !== undefined &&
				variable.value.toLowerCase().includes(query)
			)
				return true;
			return variable.value === undefined && variable.rawValue.toLowerCase().includes(query);
		});
	}, [entries, searchText]);
	return { displayedEntries, setSearchText, revealReset };
}

export const sortedLabelKeys = (labels: Record<string, string>) => Object.keys(labels).sort();
