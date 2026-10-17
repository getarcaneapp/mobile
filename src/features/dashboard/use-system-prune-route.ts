import { useLocalSearchParams } from 'expo-router';

import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';

export const systemPruneConfirmationHost = 'system-prune';

export function useSystemPruneRoute() {
	const params = useLocalSearchParams<{ envID?: string; all?: string }>();
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const environments = useEnvironmentsStore((s) => s.environments);
	return {
		environmentID: params.envID ?? activeEnvironmentID,
		environments: params.all === '1' ? environments.filter((e) => e.enabled) : undefined
	};
}
