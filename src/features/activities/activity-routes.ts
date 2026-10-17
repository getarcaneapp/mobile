/**
 * Navigation to `ActivityDetailView` (Swift: `navigationDestination(for:
 * Activity.self)` in ActivitiesView, and `ActivityDetailView(activity:)`
 * pushed from other screens). The route lives once in the shared tab group,
 * so a push stays in whichever tab stack is current.
 *
 * The activity (and optionally the Activity Center's store, so the detail
 * shares its stream) can't travel as route params; they're handed over
 * through a payload token.
 */
import { useRouter, useSegments, type Href } from 'expo-router';
import { useMemo } from 'react';

import type { Activity } from '@/sdk/models/activity/Activity';
import type { ActivityCenterStore } from '@/stores/activity-center-store';

import { ActivityDisplay } from './activity-display';

export type ActivityRoutePayload = { activity: Activity; sharedStore?: ActivityCenterStore };

const maxPayloads = 50;
const payloads = new Map<string, ActivityRoutePayload>();
let nextToken = 0;

export const activityRoutePayloads = {
	put(payload: ActivityRoutePayload): string {
		const token = `a${Date.now().toString(36)}${nextToken++}`;
		payloads.set(token, payload);
		// Payloads stay readable for re-renders of the pushed screen; drop the oldest.
		while (payloads.size > maxPayloads) {
			const oldest = payloads.keys().next().value;
			if (oldest === undefined) break;
			payloads.delete(oldest);
		}
		return token;
	},
	get(token: string | undefined): ActivityRoutePayload | undefined {
		return token ? payloads.get(token) : undefined;
	}
};

/** Routes relative to the current tab's stack. */
export function useActivityNavigation() {
	const router = useRouter();
	const segments = useSegments() as string[];
	const group =
		segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(more)';
	// Inside the Activity Center sheet, detail pushes stay in the sheet's own stack.
	const base = segments.includes('activity-center')
		? `/(tabs)/${group}/activity-center`
		: `/(tabs)/${group}`;
	return useMemo(
		() => ({
			/**
			 * Pushes `ActivityDetailView(activity:sharedStore:)`. Pass the Activity
			 * Center's store to reuse its stream; omit it for a standalone detail
			 * that opens its own.
			 */
			openActivity(activity: Activity, sharedStore?: ActivityCenterStore) {
				const token = activityRoutePayloads.put({ activity, sharedStore });
				const envID = encodeURIComponent(ActivityDisplay.sourceEnvironmentKey(activity));
				router.push(
					`${base}/activity/${encodeURIComponent(activity.id)}?envID=${envID}&token=${token}` as Href
				);
			}
		}),
		[router, base]
	);
}
