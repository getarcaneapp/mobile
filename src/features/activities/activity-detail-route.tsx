import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Activity } from '@/sdk/models/activity/Activity';

import { ActivityDetailScreen } from './activity-detail-screen';
import { activityRoutePayloads } from './activity-routes';

export function ActivityDetailRoute() {
	const {
		id = '',
		envID = '0',
		token
	} = useLocalSearchParams<{ id?: string; envID?: string; token?: string }>();
	const [payload] = useState(
		() =>
			activityRoutePayloads.get(token) ?? {
				activity: Activity.make({
					id,
					environmentID: envID,
					sourceEnvironmentID: envID,
					type: '',
					status: '',
					startedAt: '',
					createdAt: ''
				}),
				sharedStore: undefined
			}
	);
	return <ActivityDetailScreen activity={payload.activity} sharedStore={payload.sharedStore} />;
}
