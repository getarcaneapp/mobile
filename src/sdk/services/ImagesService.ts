/** Port of Services/ImagesService.swift. */
import type { ArcaneAuthorizedRequest } from '../client/ArcaneTransport';
import type { EnvironmentID } from '../client/environment';
import { boolString, q, type QueryItem } from '../client/url';
import { encodeArcaneJSON } from '../http/json';
import type { MultipartFile } from '../http/multipart';
import type { RESTService } from '../http/RESTService';
import { decodeArray } from '../models/base/decoding';
import { MessageResponse } from '../models/base/message';
import { SearchPaginationSort } from '../models/base/pagination';
import type { ContainerRegistryCredential } from '../models/containerRegistry/ContainerRegistry';
import type { ImageAttestationList } from '../models/image/ImageAttestation';
import type { ImageBuildRecord, ImageBuildRequest } from '../models/image/ImageBuild';
import type { ImageDetailSummary } from '../models/image/ImageDetail';
import { ImageHistoryItem } from '../models/image/ImageHistory';
import type {
	ImagePatchOptions,
	ImagePatchRecord,
	ImagePatchTarget,
	ImageSearchResult,
	ImageTagRequest
} from '../models/image/ImageOperations';
import type { ImagePullOptions } from '../models/image/ImagePull';
import {
	ImageSummary,
	type ImageListResponse,
	type ImageLoadResult,
	type ImagePruneReport,
	type ImageUsageCounts
} from '../models/image/ImageSummary';
import type { ImageUpdateInfo } from '../models/image/ImageUpdateInfo';
import {
	ImageUpdateBatchResponse,
	ImageUpdateResponse,
	type BatchImageUpdateRequest,
	type CheckAllImagesRequest,
	type ImageUpdateSummary
} from '../models/imageUpdate/ImageUpdate';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';
import { NDJSONStream } from '../streaming/NDJSONStream';
import { OperationStreamEvent } from '../types/streaming/OperationStreamEvent';

/** Swift `URL.lastPathComponent` for a file URI. */
function lastPathComponent(uri: string): string {
	const path = uri.replace(/[?#].*$/, '').replace(/\/+$/, '');
	const component = path.slice(path.lastIndexOf('/') + 1);
	try {
		return decodeURIComponent(component);
	} catch {
		return component;
	}
}

export class ImagesService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	// MARK: - Listing

	/** Paginated list of images in an environment. */
	async list(
		args: {
			envID?: EnvironmentID;
			query?: SearchPaginationSort;
			inUse?: string;
			updates?: string;
		} = {}
	): Promise<ImageListResponse> {
		const query = args.query ?? {};
		const items = SearchPaginationSort.nonPaginationQueryItems(query);
		if (args.inUse !== undefined) items.push(q('inUse', args.inUse));
		if (args.updates !== undefined) items.push(q('updates', args.updates));
		const response = await this.rest.paginated(this.rest.environmentPath(args.envID, 'images'), {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: items,
			decode: ImageSummary.decode
		});
		return { success: response.success, data: response.data, pagination: response.pagination };
	}

	/** Aggregate counts of images (in use / unused / total / total size). */
	usageCounts(args: { envID?: EnvironmentID } = {}): Promise<ImageUsageCounts> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'images/counts'));
	}

	/** Inspect a single image by ID. */
	inspect(args: { envID?: EnvironmentID; id: string }): Promise<ImageDetailSummary> {
		return this.rest.get(this.rest.environmentPath(args.envID, `images/${args.id}`));
	}

	/** Docker layer history for an image ID or reference. */
	history(args: { envID?: EnvironmentID; imageID: string }): Promise<ImageHistoryItem[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, `images/${args.imageID}/history`), {
			decode: decodeArray(ImageHistoryItem.decode)
		});
	}

	/**
	 * In-toto attestation statements attached to an image (provenance, SBOM, ...).
	 *
	 * @param platform restrict to one platform (e.g. `linux/amd64`).
	 * @param predicateType restrict to one predicate type URI.
	 * @param includeStatement also return the full statement payloads.
	 */
	attestations(args: {
		envID?: EnvironmentID;
		id: string;
		platform?: string;
		predicateType?: string;
		includeStatement?: boolean;
	}): Promise<ImageAttestationList> {
		const items: QueryItem[] = [];
		if (args.platform !== undefined) items.push(q('platform', args.platform));
		if (args.predicateType !== undefined) items.push(q('predicateType', args.predicateType));
		if (args.includeStatement ?? false) items.push(q('statement', 'true'));
		return this.rest.get(this.rest.environmentPath(args.envID, `images/${args.id}/attestations`), {
			query: items
		});
	}

	/** Remove an image, optionally forcing removal even if in use. */
	remove(args: { envID?: EnvironmentID; id: string; force?: boolean }): Promise<void> {
		return this.rest.deleteVoid(this.rest.environmentPath(args.envID, `images/${args.id}`), {
			query: [q('force', boolString(args.force ?? false))]
		});
	}

	/** Search Docker Hub repositories. */
	search(args: { envID?: EnvironmentID; term: string }): Promise<ImageSearchResult[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'images/search'), {
			query: [q('term', args.term)]
		});
	}

	/** Add a repository tag to an image identified by its Docker image ID. */
	tag(args: {
		envID?: EnvironmentID;
		imageID: string;
		request: ImageTagRequest;
	}): Promise<MessageResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, `images/${args.imageID}/tag`), {
			body: args.request,
			decode: MessageResponse.decode
		});
	}

	/**
	 * Replacement for Swift `export(envID:imageID:to:)`: authenticated URL +
	 * headers for streaming the image archive to disk with expo-file-system.
	 */
	exportDownloadRequest(args: {
		envID?: EnvironmentID;
		imageID: string;
	}): Promise<ArcaneAuthorizedRequest> {
		return this.rest.transport.downloadRequest(
			this.rest.environmentPath(args.envID, `images/${args.imageID}/export`)
		);
	}

	/** Start a background patch. A returned `patching` record is not completion. */
	patch(args: {
		envID?: EnvironmentID;
		imageID: string;
		options?: ImagePatchOptions;
	}): Promise<ImagePatchRecord> {
		return this.rest.post(this.rest.environmentPath(args.envID, `images/${args.imageID}/patch`), {
			body: args.options ?? {}
		});
	}

	patchTargets(
		args: { envID?: EnvironmentID; query?: SearchPaginationSort } = {}
	): Promise<PaginatedResponse<ImagePatchTarget>> {
		const query = args.query ?? {};
		return this.rest.paginated(this.rest.environmentPath(args.envID, 'images/patch-targets'), {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: SearchPaginationSort.nonPaginationQueryItems(query)
		});
	}

	listPatches(
		args: { envID?: EnvironmentID; query?: SearchPaginationSort; status?: string } = {}
	): Promise<PaginatedResponse<ImagePatchRecord>> {
		const query = args.query ?? {};
		const items = SearchPaginationSort.nonPaginationQueryItems(query);
		if (args.status !== undefined) items.push(q('status', args.status));
		return this.rest.paginated(this.rest.environmentPath(args.envID, 'images/patches'), {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: items
		});
	}

	// MARK: - Pull / Build (streaming endpoints)

	/**
	 * Initiate an image pull and drain its progress stream. Resolves when the
	 * operation emits its terminal frame. Use `pullStream` for progress.
	 */
	async pull(args: { envID?: EnvironmentID; options: ImagePullOptions }): Promise<void> {
		for await (const event of this.pullStream(args)) void event;
	}

	/** Initiate an image pull and stream NDJSON progress frames as they arrive. */
	pullStream(args: {
		envID?: EnvironmentID;
		options: ImagePullOptions;
	}): NDJSONStream<OperationStreamEvent> {
		return new NDJSONStream<OperationStreamEvent>(this.rest.transport, {
			path: this.rest.environmentPath(args.envID, 'images/pull'),
			method: 'POST',
			body: encodeArcaneJSON(args.options),
			terminalAction: OperationStreamEvent.terminalAction,
			decode: OperationStreamEvent.decode
		});
	}

	/** Initiate an image build. Use `buildStream` for progress. */
	async build(args: { envID?: EnvironmentID; request: ImageBuildRequest }): Promise<void> {
		for await (const event of this.buildStream(args)) void event;
	}

	/** Initiate an image build and stream NDJSON progress frames as they arrive. */
	buildStream(args: {
		envID?: EnvironmentID;
		request: ImageBuildRequest;
	}): NDJSONStream<OperationStreamEvent> {
		return new NDJSONStream<OperationStreamEvent>(this.rest.transport, {
			path: this.rest.environmentPath(args.envID, 'images/build'),
			method: 'POST',
			body: encodeArcaneJSON(args.request),
			terminalAction: OperationStreamEvent.terminalAction,
			decode: OperationStreamEvent.decode
		});
	}

	// MARK: - Upload

	/**
	 * Upload a Docker image tarball as a multipart file. Returns the result of
	 * loading the image into the local registry. `fileURL` is a local file URI.
	 */
	upload(args: {
		envID?: EnvironmentID;
		fileURL: string;
		filename?: string;
		fieldName?: string;
	}): Promise<ImageLoadResult> {
		const part: MultipartFile = {
			fieldName: args.fieldName ?? 'file',
			filename: args.filename ?? lastPathComponent(args.fileURL),
			uri: args.fileURL
		};
		return this.rest.transport.multipartUpload(
			this.rest.environmentPath(args.envID, 'images/upload'),
			{
				files: [part]
			}
		);
	}

	// MARK: - Build history

	/** Paginated list of historical builds for this environment. */
	listBuilds(
		args: {
			envID?: EnvironmentID;
			query?: SearchPaginationSort;
			status?: string;
			provider?: string;
		} = {}
	): Promise<PaginatedResponse<ImageBuildRecord>> {
		const query = args.query ?? {};
		const items = SearchPaginationSort.nonPaginationQueryItems(query);
		if (args.status !== undefined) items.push(q('status', args.status));
		if (args.provider !== undefined) items.push(q('provider', args.provider));
		return this.rest.paginated(this.rest.environmentPath(args.envID, 'images/builds'), {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: items
		});
	}

	/** Inspect a single build history entry. */
	getBuild(args: { envID?: EnvironmentID; buildId: string }): Promise<ImageBuildRecord> {
		return this.rest.get(this.rest.environmentPath(args.envID, `images/builds/${args.buildId}`));
	}

	// MARK: - Prune

	/** Prune unused images. `mode` is typically "all" or "dangling". */
	prune(
		args: {
			envID?: EnvironmentID;
			mode?: string;
			until?: string;
			dangling?: boolean;
			filters?: Record<string, string[]>;
		} = {}
	): Promise<ImagePruneReport> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'images/prune'), {
			body: { mode: args.mode, until: args.until, dangling: args.dangling, filters: args.filters }
		});
	}

	// MARK: - Image updates

	/** Check whether an update is available for an image referenced by repo:tag. */
	checkUpdateByRef(args: {
		envID?: EnvironmentID;
		imageRef: string;
	}): Promise<ImageUpdateResponse> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'image-updates/check'), {
			query: [q('imageRef', args.imageRef)],
			decode: ImageUpdateResponse.decode
		});
	}

	/** Check whether an update is available for an image by its Docker image ID (GET). */
	checkUpdateByID(args: { envID?: EnvironmentID; imageId: string }): Promise<ImageUpdateResponse> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `image-updates/check/${args.imageId}`),
			{
				decode: ImageUpdateResponse.decode
			}
		);
	}

	/**
	 * Check whether an update is available for an image by its Docker image ID (POST).
	 * The POST variant exists for clients that prefer non-idempotent semantics.
	 */
	checkUpdateByIDPost(args: {
		envID?: EnvironmentID;
		imageId: string;
	}): Promise<ImageUpdateResponse> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `image-updates/check/${args.imageId}`),
			{
				decode: ImageUpdateResponse.decode
			}
		);
	}

	/** Batch update check for a list of image references. */
	checkBatchUpdates(args: {
		envID?: EnvironmentID;
		imageRefs: string[];
		credentials?: ContainerRegistryCredential[];
	}): Promise<ImageUpdateBatchResponse> {
		const body: BatchImageUpdateRequest = {
			imageRefs: args.imageRefs,
			credentials: args.credentials
		};
		return this.rest.post(this.rest.environmentPath(args.envID, 'image-updates/check-batch'), {
			body,
			decode: ImageUpdateBatchResponse.decode
		});
	}

	/** Check updates for all images in the environment. */
	checkAllUpdates(
		args: { envID?: EnvironmentID; credentials?: ContainerRegistryCredential[] } = {}
	): Promise<ImageUpdateBatchResponse> {
		const body: CheckAllImagesRequest = { credentials: args.credentials };
		return this.rest.post(this.rest.environmentPath(args.envID, 'image-updates/check-all'), {
			body,
			decode: ImageUpdateBatchResponse.decode
		});
	}

	/**
	 * Look up persisted update info for a set of image references. References
	 * whose value is `null` on the wire are absent from the result.
	 */
	updateInfoByRefs(args: {
		envID?: EnvironmentID;
		imageRefs: string[];
	}): Promise<Record<string, ImageUpdateInfo | undefined>> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'image-updates/by-refs'), {
			query: [q('imageRefs', args.imageRefs.join(','))]
		});
	}

	/** Aggregate summary of image updates for the environment. */
	updateSummary(args: { envID?: EnvironmentID } = {}): Promise<ImageUpdateSummary> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'image-updates/summary'));
	}
}
