import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { screenCache } from '@/features/networks/tab-routes';

import { swarmKeys } from './swarm-routes';

export function useServiceVars(): string[] {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const [vars] = useState(() => screenCache.get<string[]>(swarmKeys.serviceVars(envID, id)) ?? []);
	return vars;
}

export function useServiceLabels(): Record<string, string> {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const [labels] = useState(
		() => screenCache.get<Record<string, string>>(swarmKeys.serviceLabels(envID, id)) ?? {}
	);
	return labels;
}
