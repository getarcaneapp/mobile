import { useLocalSearchParams } from 'expo-router';

import { displayName } from '@/features/dashboard/dashboard-logic';
import { useEnvironmentsStore } from '@/stores/environments-store';

export function useEnvironmentColorRoute() {
	const { id = '', name } = useLocalSearchParams<{ id?: string; name?: string }>();
	const environment = useEnvironmentsStore((s) => s.environments.find((e) => e.id === id));
	return {
		environmentID: id,
		displayName: environment
			? displayName(environment)
			: displayName({ id, name: name !== '' && name !== id ? name : undefined })
	};
}
