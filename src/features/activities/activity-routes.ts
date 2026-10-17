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

export function useActivityNavigation() {
	const router = useRouter();
	const segments = useSegments() as string[];
	const group =
		segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(more)';
	const base = segments.includes('activity-center')
		? `/(tabs)/${group}/activity-center`
		: `/(tabs)/${group}`;
	return useMemo(
		() => ({
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
