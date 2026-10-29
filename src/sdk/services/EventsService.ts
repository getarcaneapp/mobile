import type { QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { SortOrder } from '../models/base/pagination';
import type { Event, EventSeverityCounts } from '../models/event/Event';
import { EnvironmentChanges, EnvironmentChangesEvent } from '../models/event/EnvironmentChanges';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';
import { NDJSONStream } from '../streaming/NDJSONStream';

interface EventListOptions {
	search?: string;
	sort?: string;
	order?: SortOrder;
	severity?: string;
	type?: string;
}

function eventListQueryItems(options: EventListOptions): QueryItem[] {
	const query: QueryItem[] = [];
	if (options.search !== undefined) query.push({ name: 'search', value: options.search });
	if (options.sort !== undefined) query.push({ name: 'sort', value: options.sort });
	if (options.order !== undefined) query.push({ name: 'order', value: options.order });
	if (options.severity !== undefined) query.push({ name: 'severity', value: options.severity });
	if (options.type !== undefined) query.push({ name: 'type', value: options.type });
	return query;
}

export class EventsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	changesStream(): NDJSONStream<EnvironmentChangesEvent> {
		return new NDJSONStream<EnvironmentChangesEvent>(this.rest.transport, {
			path: 'stream',
			method: 'GET',
			contentType: null,
			query: [{ name: 'channels', value: 'events' }],
			decode: EnvironmentChangesEvent.decode
		});
	}

	waitForChanges(args: {
		envID: string;
		epoch?: string;
		since?: number;
		waitSeconds?: number;
	}): Promise<EnvironmentChanges> {
		const query: QueryItem[] = [];
		if (args.epoch !== undefined) query.push({ name: 'epoch', value: args.epoch });
		if (args.since !== undefined) query.push({ name: 'since', value: String(args.since) });
		if (args.waitSeconds !== undefined)
			query.push({ name: 'wait', value: String(args.waitSeconds) });
		return this.rest.get(this.rest.environmentPath(args.envID, 'events/changes'), {
			query,
			decode: EnvironmentChanges.decode
		});
	}

	listPaginated(
		args: EventListOptions & { start?: number; limit?: number } = {}
	): Promise<PaginatedResponse<Event>> {
		return this.rest.transport.paginated<Event>('events', {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query: eventListQueryItems(args)
		});
	}

	listByEnvironmentPaginated(
		args: EventListOptions & { environmentID: string; start?: number; limit?: number }
	): Promise<PaginatedResponse<Event>> {
		return this.rest.transport.paginated<Event>(`events/environment/${args.environmentID}`, {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query: eventListQueryItems(args)
		});
	}

	stats(): Promise<EventSeverityCounts> {
		return this.rest.get('events/stats');
	}

	delete(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`events/${args.id}`);
	}
}
