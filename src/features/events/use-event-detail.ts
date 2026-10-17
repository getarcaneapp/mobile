/** `EventDetailView` reads the event handed over by the list row. */
import { useLocalSearchParams } from 'expo-router';

import { parseArcaneDate } from '@/sdk/models/base/date';
import type { Event } from '@/sdk/models/event/Event';

import { screenCache } from '@/features/networks/tab-routes';

import { eventCacheKey, formattedEventDate, metadataMap } from './use-events';

export function useEventDetail() {
	const { id = '' } = useLocalSearchParams<{ id?: string }>();
	const event = screenCache.get<Event>(eventCacheKey(id));
	if (!event) return undefined;
	const metadata = metadataMap(event);
	return {
		event,
		occurred: formattedEventDate(event.timestamp),
		// Swift compares decoded Dates (ISO8601DateFormatter: millisecond precision); the wire
		// strings differ in the nanoseconds, so compare parsed dates, not strings.
		recorded:
			parseArcaneDate(event.createdAt)?.getTime() !== parseArcaneDate(event.timestamp)?.getTime()
				? formattedEventDate(event.createdAt)
				: undefined,
		hasResource:
			event.resourceType !== undefined ||
			event.resourceName !== undefined ||
			event.resourceId !== undefined,
		hasContext:
			event.username !== undefined ||
			event.userId !== undefined ||
			event.environmentId !== undefined,
		metadata: Object.keys(metadata)
			.sort()
			.map((key) => ({ key, value: metadata[key] ?? '' }))
	};
}
