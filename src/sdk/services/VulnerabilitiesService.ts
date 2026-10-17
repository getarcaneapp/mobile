import type { ArcaneAuthorizedRequest } from '../client/ArcaneTransport';
import type { EnvironmentID } from '../client/environment';
import { boolString, q, type QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import { decodeArray, D } from '../models/base/decoding';
import { SearchPaginationSort, type SortOrder } from '../models/base/pagination';
import type {
	EnvironmentVulnerabilitySummary,
	Vulnerability,
	VulnerabilityWithImage
} from '../models/vulnerability/Vulnerability';
import {
	VulnerabilityScanResult,
	type IgnoredVulnerability,
	type VulnerabilityIgnorePayload,
	type VulnerabilityScanSummariesRequest,
	type VulnerabilityScanSummariesResponse,
	type VulnerabilityScannerStatus,
	type VulnerabilityScanSummary
} from '../models/vulnerability/VulnerabilityScan';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';
import type { VulnerabilityRiskOverview } from '../types/VulnerabilityRiskOverview';

interface ExportAllArgs {
	envID?: EnvironmentID;
	search?: string;
	sort?: string;
	order?: SortOrder;
	severity?: string;
	imageName?: string;
	ignored?: boolean;
	fixAvailable?: boolean;
}

function exportQueryItems(args: ExportAllArgs): QueryItem[] {
	const items: QueryItem[] = [];
	if (args.search !== undefined) items.push(q('search', args.search));
	if (args.sort !== undefined) items.push(q('sort', args.sort));
	if (args.order !== undefined) items.push(q('order', args.order));
	if (args.severity !== undefined) items.push(q('severity', args.severity));
	if (args.imageName !== undefined) items.push(q('imageName', args.imageName));
	if (args.ignored !== undefined) items.push(q('ignored', boolString(args.ignored)));
	if (args.fixAvailable !== undefined) items.push(q('fixAvailable', boolString(args.fixAvailable)));
	return items;
}

export class VulnerabilitiesService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	scanImage(args: { envID?: EnvironmentID; imageId: string }): Promise<VulnerabilityScanResult> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `images/${args.imageId}/vulnerabilities/scan`),
			{ decode: VulnerabilityScanResult.decode }
		);
	}

	scanResult(args: { envID?: EnvironmentID; imageId: string }): Promise<VulnerabilityScanResult> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `images/${args.imageId}/vulnerabilities`),
			{
				decode: VulnerabilityScanResult.decode
			}
		);
	}

	scanSummary(args: { envID?: EnvironmentID; imageId: string }): Promise<VulnerabilityScanSummary> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `images/${args.imageId}/vulnerabilities/summary`)
		);
	}

	scanSummaries(args: {
		envID?: EnvironmentID;
		imageIds: string[];
	}): Promise<VulnerabilityScanSummariesResponse> {
		const body: VulnerabilityScanSummariesRequest = { imageIds: args.imageIds };
		return this.rest.post(
			this.rest.environmentPath(args.envID, 'images/vulnerabilities/summaries'),
			{ body }
		);
	}

	listForImage(args: {
		envID?: EnvironmentID;
		imageId: string;
		query?: SearchPaginationSort;
		severity?: string;
	}): Promise<PaginatedResponse<Vulnerability>> {
		const query = args.query ?? {};
		const items = SearchPaginationSort.nonPaginationQueryItems(query);
		if (args.severity !== undefined) items.push(q('severity', args.severity));
		return this.rest.paginated(
			this.rest.environmentPath(args.envID, `images/${args.imageId}/vulnerabilities/list`),
			{ start: query.start ?? 0, limit: query.limit ?? 20, query: items }
		);
	}

	scannerStatus(args: { envID?: EnvironmentID } = {}): Promise<VulnerabilityScannerStatus> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'vulnerabilities/scanner-status'));
	}

	environmentSummary(
		args: { envID?: EnvironmentID } = {}
	): Promise<EnvironmentVulnerabilitySummary> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'vulnerabilities/summary'));
	}

	riskOverview(args: { envID?: EnvironmentID } = {}): Promise<VulnerabilityRiskOverview> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'vulnerabilities/overview'));
	}

	listAll(
		args: {
			envID?: EnvironmentID;
			query?: SearchPaginationSort;
			severity?: string;
			imageName?: string;
			ignored?: boolean;
			fixAvailable?: boolean;
		} = {}
	): Promise<PaginatedResponse<VulnerabilityWithImage>> {
		const query = args.query ?? {};
		const items = SearchPaginationSort.nonPaginationQueryItems(query);
		if (args.severity !== undefined) items.push(q('severity', args.severity));
		if (args.imageName !== undefined) items.push(q('imageName', args.imageName));
		if (args.ignored !== undefined) items.push(q('ignored', boolString(args.ignored)));
		if (args.fixAvailable !== undefined)
			items.push(q('fixAvailable', boolString(args.fixAvailable)));
		return this.rest.paginated(this.rest.environmentPath(args.envID, 'vulnerabilities/all'), {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: items
		});
	}

	exportAll(args: ExportAllArgs = {}): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw(
			this.rest.environmentPath(args.envID, 'vulnerabilities/export'),
			{
				query: exportQueryItems(args)
			}
		);
	}

	exportAllDownloadRequest(args: ExportAllArgs = {}): Promise<ArcaneAuthorizedRequest> {
		return this.rest.transport.downloadRequest(
			this.rest.environmentPath(args.envID, 'vulnerabilities/export'),
			{ query: exportQueryItems(args) }
		);
	}

	imageOptions(args: { envID?: EnvironmentID; severity?: string } = {}): Promise<string[]> {
		const items: QueryItem[] = [];
		if (args.severity !== undefined) items.push(q('severity', args.severity));
		return this.rest.get(this.rest.environmentPath(args.envID, 'vulnerabilities/image-options'), {
			query: items,
			decode: decodeArray(D.str)
		});
	}

	ignore(args: {
		envID?: EnvironmentID;
		payload: VulnerabilityIgnorePayload;
	}): Promise<IgnoredVulnerability> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'vulnerabilities/ignore'), {
			body: args.payload
		});
	}

	async unignore(args: { envID?: EnvironmentID; ignoreId: string }): Promise<void> {
		await this.rest.delete<unknown>(
			this.rest.environmentPath(args.envID, `vulnerabilities/ignore/${args.ignoreId}`)
		);
	}

	listIgnored(
		args: { envID?: EnvironmentID; query?: SearchPaginationSort } = {}
	): Promise<PaginatedResponse<IgnoredVulnerability>> {
		const query = args.query ?? {};
		return this.rest.paginated(this.rest.environmentPath(args.envID, 'vulnerabilities/ignored'), {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: SearchPaginationSort.nonPaginationQueryItems(query)
		});
	}
}
