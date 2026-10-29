import { EnvironmentID } from '../client/environment';
import type { QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { APIKey } from '../models/apiKey/APIKey';
import { parseArcaneDate } from '../models/base/date';
import { ContainerStatusCounts } from '../models/container/ContainerSummary';
import {
	ActionItems,
	DashboardEnvironmentsOverview,
	DashboardSnapshot,
	DashboardSnapshotSettings,
	type ActionItem
} from '../models/dashboard/Dashboard';
import { ImageUsageCounts } from '../models/image/ImageSummary';
import type { ProjectStatusCounts } from '../models/project/Project';
import type { VersionInfo } from '../models/version/VersionInfo';
import type { EnvironmentVulnerabilitySummary } from '../models/vulnerability/Vulnerability';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';
import { DashboardStreamEvent } from '../models/dashboard/DashboardStream';
import { NDJSONStream } from '../streaming/NDJSONStream';

const API_KEY_EXPIRY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function debugQuery(debugAllGood: boolean): QueryItem[] {
	if (!debugAllGood) return [];
	return [{ name: 'debugAllGood', value: 'true' }];
}

export class DashboardService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	async snapshot(
		args: { envID?: EnvironmentID; debugAllGood?: boolean } = {}
	): Promise<DashboardSnapshot> {
		if ((await this.rest.transport.apiGeneration()) === 'v3') return this.composedSnapshot(args);
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

	private async composedSnapshot(args: {
		envID?: EnvironmentID;
		debugAllGood?: boolean;
	}): Promise<DashboardSnapshot> {
		const envID = args.envID ?? this.rest.defaultEnvironmentID;
		const optional = <T>(promise: Promise<T>) => promise.catch(() => undefined);
		const [containerCounts, imageCounts, projectCounts, vulnerabilities, versionInfo, apiKeys] =
			await Promise.all([
				this.rest.get<ContainerStatusCounts>(this.rest.environmentPath(envID, 'containers/counts')),
				optional(
					this.rest.get<ImageUsageCounts>(this.rest.environmentPath(envID, 'images/counts'))
				),
				optional(
					this.rest.get<ProjectStatusCounts>(this.rest.environmentPath(envID, 'projects/counts'))
				),
				optional(
					this.rest.get<EnvironmentVulnerabilitySummary>(
						this.rest.environmentPath(envID, 'vulnerabilities/summary')
					)
				),
				optional(this.rest.get<VersionInfo>(`environments/${envID}/version`)),
				envID === EnvironmentID.localDocker && !args.debugAllGood
					? optional(this.rest.transport.paginated<APIKey>('api-keys', { start: 0, limit: 100 }))
					: Promise.resolve(undefined)
			]);
		const counts = ContainerStatusCounts.make(containerCounts);
		const items: ActionItem[] = args.debugAllGood
			? []
			: [
					{
						kind: 'stopped_containers',
						count: counts.stoppedContainers,
						severity: 'warning'
					},
					{
						kind: 'image_updates',
						count: (counts.updatesAvailable ?? 0) + (projectCounts?.updatesAvailable ?? 0),
						severity: 'warning'
					},
					{
						kind: 'actionable_vulnerabilities',
						count: vulnerabilities?.actionableCount ?? 0,
						severity: 'critical'
					},
					{ kind: 'expiring_keys', count: expiringKeyCount(apiKeys), severity: 'warning' }
				];
		return {
			containers: {
				data: [],
				counts,
				pagination: {
					totalPages: 0,
					totalItems: counts.totalContainers,
					currentPage: 1,
					itemsPerPage: 0
				}
			},
			images: {
				data: [],
				pagination: {
					totalPages: 0,
					totalItems: imageCounts?.totalImages ?? 0,
					currentPage: 1,
					itemsPerPage: 0
				}
			},
			imageUsageCounts: ImageUsageCounts.make(imageCounts),
			actionItems: ActionItems.make(items.filter((item) => item.count > 0)),
			settings: DashboardSnapshotSettings.make(),
			versionInfo
		};
	}
}

function expiringKeyCount(page: PaginatedResponse<APIKey> | undefined): number {
	if (!page) return 0;
	const cutoff = Date.now() + API_KEY_EXPIRY_WINDOW_MS;
	return page.data.filter((key) => {
		const expiresAt = key.expiresAt ? parseArcaneDate(key.expiresAt) : undefined;
		return expiresAt !== undefined && expiresAt.getTime() <= cutoff;
	}).length;
}
