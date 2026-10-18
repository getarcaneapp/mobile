import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { parseArcaneDate } from '@/sdk/models/base/date';
import type { Event } from '@/sdk/models/event/Event';
import { titleCasedWords } from '@/core/title-case';
import { environmentDisplayName, useEnvironmentsStore } from '@/stores/environments-store';

import { screenCache } from '@/features/networks/tab-routes';

import { eventCacheKey, formattedEventDate, metadataMap } from './use-events';

const datesDiffer = (a: string, b: string) =>
	parseArcaneDate(a)?.getTime() !== parseArcaneDate(b)?.getTime();

export function useEventDetail() {
	const { id = '' } = useLocalSearchParams<{ id?: string }>();
	const event = screenCache.get<Event>(eventCacheKey(id));
	const environmentID = event?.environmentId;
	const environment = useEnvironmentsStore((s) =>
		environmentID === undefined ? undefined : s.environments.find((e) => e.id === environmentID)
	);
	const hasLoadedEnvironments = useEnvironmentsStore((s) => s.hasLoaded);
	useEffect(() => {
		if (environmentID !== undefined && !hasLoadedEnvironments)
			void useEnvironmentsStore.getState().load({ loadsEnvironmentDetails: false });
	}, [environmentID, hasLoadedEnvironments]);
	if (!event) return undefined;
	const metadata = metadataMap(event);
	return {
		event,
		typeTitle: event.type === '' ? 'Unknown' : titleCasedWords(event.type),
		environmentName:
			environment !== undefined
				? environmentDisplayName(environment)
				: event.environmentId
					? `Environment ${event.environmentId}`
					: undefined,
		occurred: formattedEventDate(event.timestamp),
		recorded: datesDiffer(event.createdAt, event.timestamp)
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
