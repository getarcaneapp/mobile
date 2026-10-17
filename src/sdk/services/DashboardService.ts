import type { EnvironmentID } from '../client/environment';
import type { QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import {
	ActionItems,
	DashboardEnvironmentsOverview,
	DashboardSnapshot
} from '../models/dashboard/Dashboard';
import { DashboardStreamEvent } from '../models/dashboard/DashboardStream';
import { NDJSONStream } from '../streaming/NDJSONStream';

function debugQuery(debugAllGood: boolean): QueryItem[] {
	if (!debugAllGood) return [];
	return [{ name: 'debugAllGood', value: 'true' }];
}

export class DashboardService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	snapshot(
		args: { envID?: EnvironmentID; debugAllGood?: boolean } = {}
	): Promise<DashboardSnapshot> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'dashboard'), {
			query: debugQuery(args.debugAllGood ?? false),
			decode: DashboardSnapshot.decode
		});
	}

	actionItems(args: { envID?: EnvironmentID; debugAllGood?: boolean } = {}): Promise<ActionItems> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'dashboard/action-items'), {
			query: debugQuery(args.debugAllGood ?? false),
			decode: ActionItems.decode
		});
	}

	environmentsOverview(
		args: { debugAllGood?: boolean } = {}
	): Promise<DashboardEnvironmentsOverview> {
		return this.rest.get('dashboard/environments', {
			query: debugQuery(args.debugAllGood ?? false),
			decode: DashboardEnvironmentsOverview.decode
		});
	}

	stream(args: { debugAllGood?: boolean } = {}): NDJSONStream<DashboardStreamEvent> {
		return new NDJSONStream<DashboardStreamEvent>(this.rest.transport, {
			path: 'dashboard/stream',
			method: 'GET',
			contentType: null,
			query: debugQuery(args.debugAllGood ?? false),
			decode: DashboardStreamEvent.decode
		});
	}
}
