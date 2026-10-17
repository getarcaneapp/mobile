/** Port of Services/EventsService.swift: EventsService manages system audit events. */
import type { QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { SortOrder } from '../models/base/pagination';
import type { Event, EventSeverityCounts } from '../models/event/Event';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

interface EventListOptions {
	search?: string;
	sort?: string;
	order?: SortOrder;
	severity?: string;
	type?: string;
}

/** Swift private `EventListOptions.queryItems`. */
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

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** List system events with pagination and optional filters. */
	listPaginated(
		args: EventListOptions & { start?: number; limit?: number } = {}
	): Promise<PaginatedResponse<Event>> {
		return this.rest.transport.paginated<Event>('events', {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query: eventListQueryItems(args)
		});
	}

	/** List events scoped to a specific environment ID. */
	listByEnvironmentPaginated(
		args: EventListOptions & { environmentID: string; start?: number; limit?: number }
	): Promise<PaginatedResponse<Event>> {
		return this.rest.transport.paginated<Event>(`events/environment/${args.environmentID}`, {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query: eventListQueryItems(args)
		});
	}

	/** Returns global event counts grouped by severity. */
	stats(): Promise<EventSeverityCounts> {
		return this.rest.get('events/stats');
	}

	/** Delete an event by ID. */
	delete(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`events/${args.id}`);
	}
}
