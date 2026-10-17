import { useLocalSearchParams } from 'expo-router';

import { GitOpsSyncsView } from '@/features/customize/gitops/gitops-destination';

export default function Route() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <GitOpsSyncsView key={id} environmentID={id} allEnvironments={false} />;
}
