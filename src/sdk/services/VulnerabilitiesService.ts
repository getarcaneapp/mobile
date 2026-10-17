/** Port of Services/VulnerabilitiesService.swift. */
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

	// MARK: - Scans (per-image)

	/**
	 * Initiate a new Trivy scan for an image. Returns the resulting scan record
	 * once the scan completes.
	 */
	scanImage(args: { envID?: EnvironmentID; imageId: string }): Promise<VulnerabilityScanResult> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `images/${args.imageId}/vulnerabilities/scan`),
			{ decode: VulnerabilityScanResult.decode }
		);
	}

	/** Most recent full scan result for an image. */
	scanResult(args: { envID?: EnvironmentID; imageId: string }): Promise<VulnerabilityScanResult> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `images/${args.imageId}/vulnerabilities`),
			{
				decode: VulnerabilityScanResult.decode
			}
		);
	}

	/** Compact severity summary for an image. Suitable for list views. */
	scanSummary(args: { envID?: EnvironmentID; imageId: string }): Promise<VulnerabilityScanSummary> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `images/${args.imageId}/vulnerabilities/summary`)
		);
	}

	/** Batch lookup of scan summaries keyed by image ID. */
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

	/** Paginated list of vulnerabilities for a specific image. */
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

	// MARK: - Environment-wide

	/** Status of the bundled Trivy scanner. */
	scannerStatus(args: { envID?: EnvironmentID } = {}): Promise<VulnerabilityScannerStatus> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'vulnerabilities/scanner-status'));
	}

	/** Aggregated vulnerability counts across all images in the environment. */
	environmentSummary(
		args: { envID?: EnvironmentID } = {}
	): Promise<EnvironmentVulnerabilitySummary> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'vulnerabilities/summary'));
	}

	/** Environment patch priority, trend, drivers, and ranked findings and images. */
	riskOverview(args: { envID?: EnvironmentID } = {}): Promise<VulnerabilityRiskOverview> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'vulnerabilities/overview'));
	}

	/** Paginated list of vulnerabilities across all scanned images in the environment. */
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

	/** Download every vulnerability matching the filters as CSV raw bytes. */
	exportAll(args: ExportAllArgs = {}): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw(
			this.rest.environmentPath(args.envID, 'vulnerabilities/export'),
			{
				query: exportQueryItems(args)
			}
		);
	}

	/**
	 * Replacement for Swift `exportAll(..., to:)`: the authenticated request
	 * for streaming the CSV export to disk with expo-file-system.
	 */
	exportAllDownloadRequest(args: ExportAllArgs = {}): Promise<ArcaneAuthorizedRequest> {
		return this.rest.transport.downloadRequest(
			this.rest.environmentPath(args.envID, 'vulnerabilities/export'),
			{ query: exportQueryItems(args) }
		);
	}

	/** Distinct image names available for vulnerability filtering. */
	imageOptions(args: { envID?: EnvironmentID; severity?: string } = {}): Promise<string[]> {
		const items: QueryItem[] = [];
		if (args.severity !== undefined) items.push(q('severity', args.severity));
		return this.rest.get(this.rest.environmentPath(args.envID, 'vulnerabilities/image-options'), {
			query: items,
			decode: decodeArray(D.str)
		});
	}

	// MARK: - Ignore records

	/** Create an ignore record for a specific vulnerability finding. */
	ignore(args: {
		envID?: EnvironmentID;
		payload: VulnerabilityIgnorePayload;
	}): Promise<IgnoredVulnerability> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'vulnerabilities/ignore'), {
			body: args.payload
		});
	}

	/** Remove an existing ignore record. */
	async unignore(args: { envID?: EnvironmentID; ignoreId: string }): Promise<void> {
		// Swift decodes the envelope into an empty `Decodable` struct and discards it.
		await this.rest.delete<unknown>(
			this.rest.environmentPath(args.envID, `vulnerabilities/ignore/${args.ignoreId}`)
		);
	}

	/** Paginated list of currently ignored vulnerabilities. */
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
