/** Port of Services/DashboardService.swift. */
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

/** Facade for the dashboard endpoints. */
export class DashboardService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** Returns the per-environment dashboard first-paint snapshot. */
	snapshot(
		args: { envID?: EnvironmentID; debugAllGood?: boolean } = {}
	): Promise<DashboardSnapshot> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'dashboard'), {
			query: debugQuery(args.debugAllGood ?? false),
			decode: DashboardSnapshot.decode
		});
	}

	/** Returns just the dashboard action items that currently need attention. */
	actionItems(args: { envID?: EnvironmentID; debugAllGood?: boolean } = {}): Promise<ActionItems> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'dashboard/action-items'), {
			query: debugQuery(args.debugAllGood ?? false),
			decode: ActionItems.decode
		});
	}

	/**
	 * Returns the aggregate dashboard overview across every visible
	 * environment. v1-only: v2 servers have no `/dashboard/environments`.
	 */
	environmentsOverview(
		args: { debugAllGood?: boolean } = {}
	): Promise<DashboardEnvironmentsOverview> {
		return this.rest.get('dashboard/environments', {
			query: debugQuery(args.debugAllGood ?? false),
			decode: DashboardEnvironmentsOverview.decode
		});
	}

	/**
	 * Stream dashboard snapshot updates for the local environment and every
	 * enabled remote environment as NDJSON over a single connection. Global
	 * endpoint — not environment-scoped. Snapshot events have their
	 * container/image table rows trimmed; only the aggregate counts, action
	 * items, settings, and version info are populated.
	 */
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
