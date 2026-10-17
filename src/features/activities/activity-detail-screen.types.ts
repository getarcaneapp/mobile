import type { Activity } from '@/sdk/models/activity/Activity';
import type { ActivityCenterStore } from '@/stores/activity-center-store';

export type ActivityDetailScreenProps = {
	activity: Activity;
	sharedStore?: ActivityCenterStore;
};
