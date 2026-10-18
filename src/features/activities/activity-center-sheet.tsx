import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { ToastHost } from '@/ui/toast';

import { ActivitiesScreen } from './activities-screen';
import { ActivityStatusFilter } from './activity-display';

function statusFilterParam(value: string | undefined): ActivityStatusFilter | undefined {
	return ActivityStatusFilter.allCases.find((filter) => filter === value);
}

export function ActivityCenterSheet() {
	const router = useRouter();
	const { status } = useLocalSearchParams<{ status?: string }>();
	return (
		<View style={{ flex: 1 }}>
			<ActivitiesScreen
				onDone={() => router.dismiss()}
				initialStatusFilter={statusFilterParam(status)}
			/>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
