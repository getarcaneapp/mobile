import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/features/navigation/stack-options';

export default function ActivityCenterLayout() {
	const screenOptions = useStackScreenOptions();
	return <Stack screenOptions={screenOptions} />;
}
