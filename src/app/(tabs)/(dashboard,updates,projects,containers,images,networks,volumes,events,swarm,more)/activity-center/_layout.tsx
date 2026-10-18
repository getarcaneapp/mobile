import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/features/navigation/stack-options';
import { ActivityCenterStackContext } from '@/features/navigation/tab-stack-group';

export default function ActivityCenterLayout() {
	const screenOptions = useStackScreenOptions();
	return (
		<ActivityCenterStackContext value>
			<Stack screenOptions={screenOptions} />
		</ActivityCenterStackContext>
	);
}
