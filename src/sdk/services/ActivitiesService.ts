/**
 * Port of Services/ActivitiesService.swift.
 *
 * ActivitiesService manages v2 background activity lists, details, streams,
 * cancellation, and history cleanup. Gate on `ServerCapabilities.supportsActivities`.
 */
import type { EnvironmentID } from '../client/environment';
import type { QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import {
	Activity,
	ActivityDetail,
	ActivityStreamEvent,
	type ActivityStatus,
	type ActivityType,
	type ClearActivityHistoryResult
} from '../models/activity/Activity';
import type { SortOrder } from '../models/base/pagination';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';
import { NDJSONStream } from '../streaming/NDJSONStream';

/** Swift private `ActivityListFilters.queryItems`. */
function activityListFilterQueryItems(filters: {
	search?: string;
	sort?: string;
	order?: SortOrder;
	status?: ActivityStatus;
	type?: ActivityType;
	resourceType?: string;
}): QueryItem[] {
	const items: QueryItem[] = [];
	if (filters.search) items.push({ name: 'search', value: filters.search });
	if (filters.sort) items.push({ name: 'sort', value: filters.sort });
	if (filters.order !== undefined) items.push({ name: 'order', value: filters.order });
	if (filters.status !== undefined) items.push({ name: 'status', value: filters.status });
	if (filters.type !== undefined) items.push({ name: 'type', value: filters.type });
	if (filters.resourceType) items.push({ name: 'resourceType', value: filters.resourceType });
	return items;
}

export class ActivitiesService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** List current and recent background activities for an environment. */
	listPaginated(
		args: {
			envID?: EnvironmentID;
			search?: string;
			sort?: string;
			order?: SortOrder;
			start?: number;
			limit?: number;
			status?: ActivityStatus;
			type?: ActivityType;
			resourceType?: string;
		} = {}
	): Promise<PaginatedResponse<Activity>> {
		return this.rest.transport.paginated(this.rest.environmentPath(args.envID, 'activities'), {
			start: args.start ?? 0,
			limit: args.limit ?? 50,
			query: activityListFilterQueryItems(args),
			decode: Activity.decode
		});
	}

	/** Get a background activity with its recent output messages. */
	detail(args: {
		envID?: EnvironmentID;
		activityID: string;
		limit?: number;
	}): Promise<ActivityDetail> {
		return this.rest.get(this.rest.environmentPath(args.envID, `activities/${args.activityID}`), {
			query: [{ name: 'limit', value: String(args.limit ?? 500) }],
			decode: ActivityDetail.decode
		});
	}

	/**
	 * Stream activity snapshots and updates as NDJSON. Uses the multiplexed
	 * activities channel, falling back to the older v2 endpoint only on HTTP 404.
	 */
	stream(args: { limit?: number } = {}): NDJSONStream<ActivityStreamEvent> {
		const limit = args.limit ?? 50;
		return new NDJSONStream<ActivityStreamEvent>(this.rest.transport, {
			path: 'stream',
			method: 'GET',
			body: undefined,
			contentType: null,
			query: [
				{ name: 'channels', value: 'activities' },
				{ name: 'limit', value: String(limit) }
			],
			notFoundFallback: {
				path: 'activities/stream',
				query: [{ name: 'limit', value: String(limit) }]
			},
			decode: ActivityStreamEvent.decode
		});
	}

	/** Request cancellation for a running or queued activity. */
	cancel(args: {
		envID?: EnvironmentID;
		activityID: string;
		requestedBy?: string;
	}): Promise<Activity> {
		const query: QueryItem[] = [];
		if (args.requestedBy) query.push({ name: 'requestedBy', value: args.requestedBy });
		return this.rest.post(
			this.rest.environmentPath(args.envID, `activities/${args.activityID}/cancel`),
			{
				query,
				decode: Activity.decode
			}
		);
	}

	/** Clear completed activity history for an environment. */
	clearHistory(args: { envID?: EnvironmentID } = {}): Promise<ClearActivityHistoryResult> {
		return this.rest.delete(this.rest.environmentPath(args.envID, 'activities/history'));
	}
}
