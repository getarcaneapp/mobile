import type { Activity } from '@/sdk/models/activity/Activity';
import type { ActivityCenterStore } from '@/stores/activity-center-store';

export type ActivityDetailScreenProps = {
	/** `ActivityDetailView(activity:)`'s initial activity. */
	activity: Activity;
	/** The Activity Center's store when pushed from it: its stream already carries this activity. */
	sharedStore?: ActivityCenterStore;
};
