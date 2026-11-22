import { Stack } from 'expo-router';

import { useSheetStackScreenOptions } from '@/features/navigation/stack-options';
import { ActivityCenterStackContext } from '@/features/navigation/tab-stack-group';

export default function ActivityCenterLayout() {
	const screenOptions = useSheetStackScreenOptions();
	return (
		<ActivityCenterStackContext value>
			<Stack screenOptions={screenOptions} />
		</ActivityCenterStackContext>
	);
}
