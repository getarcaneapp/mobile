import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { DeleteConfirmationHost } from '@/ui/components/delete-confirmation';
import { ToastHost } from '@/ui/toast';

import { ActivitiesScreen } from './activities-screen';
import { ActivityStatusFilter } from './activity-display';
import { activityCenterConfirmationHost } from './use-activities';

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
				confirmationHostID={activityCenterConfirmationHost}
			/>
			<DeleteConfirmationHost hostID={activityCenterConfirmationHost} />
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
