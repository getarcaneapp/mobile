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

	constructor(rest: RESTService) {
		this.rest = rest;
	}

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
		return {
			success: response.success,
			data: response.data,
			pagination: response.pagination,
			failedEnvironments: response.failedEnvironments
		};
	}

	usageCounts(args: { envID?: EnvironmentID } = {}): Promise<ImageUsageCounts> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'images/counts'));
	}

	inspect(args: { envID?: EnvironmentID; id: string }): Promise<ImageDetailSummary> {
		return this.rest.get(this.rest.environmentPath(args.envID, `images/${args.id}`));
	}

	history(args: { envID?: EnvironmentID; imageID: string }): Promise<ImageHistoryItem[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, `images/${args.imageID}/history`), {
			decode: decodeArray(ImageHistoryItem.decode)
		});
	}

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

	remove(args: { envID?: EnvironmentID; id: string; force?: boolean }): Promise<void> {
		return this.rest.deleteVoid(this.rest.environmentPath(args.envID, `images/${args.id}`), {
			query: [q('force', boolString(args.force ?? false))]
		});
	}

	search(args: { envID?: EnvironmentID; term: string }): Promise<ImageSearchResult[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'images/search'), {
			query: [q('term', args.term)]
		});
	}

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

	exportDownloadRequest(args: {
		envID?: EnvironmentID;
		imageID: string;
	}): Promise<ArcaneAuthorizedRequest> {
		return this.rest.transport.downloadRequest(
			this.rest.environmentPath(args.envID, `images/${args.imageID}/export`)
		);
	}

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

	async pull(args: { envID?: EnvironmentID; options: ImagePullOptions }): Promise<void> {
		for await (const event of this.pullStream(args)) void event;
	}

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

	async build(args: { envID?: EnvironmentID; request: ImageBuildRequest }): Promise<void> {
		for await (const event of this.buildStream(args)) void event;
	}

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

	getBuild(args: { envID?: EnvironmentID; buildId: string }): Promise<ImageBuildRecord> {
		return this.rest.get(this.rest.environmentPath(args.envID, `images/builds/${args.buildId}`));
	}

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

	checkUpdateByRef(args: {
		envID?: EnvironmentID;
		imageRef: string;
	}): Promise<ImageUpdateResponse> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'image-updates/check'), {
			query: [q('imageRef', args.imageRef)],
			decode: ImageUpdateResponse.decode
		});
	}

	checkUpdateByID(args: { envID?: EnvironmentID; imageId: string }): Promise<ImageUpdateResponse> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `image-updates/check/${args.imageId}`),
			{
				decode: ImageUpdateResponse.decode
			}
		);
	}

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

	checkAllUpdates(
		args: { envID?: EnvironmentID; credentials?: ContainerRegistryCredential[] } = {}
	): Promise<ImageUpdateBatchResponse> {
		const body: CheckAllImagesRequest = { credentials: args.credentials };
		return this.rest.post(this.rest.environmentPath(args.envID, 'image-updates/check-all'), {
			body,
			decode: ImageUpdateBatchResponse.decode
		});
	}

	updateInfoByRefs(args: {
		envID?: EnvironmentID;
		imageRefs: string[];
	}): Promise<Record<string, ImageUpdateInfo | undefined>> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'image-updates/by-refs'), {
			query: [q('imageRefs', args.imageRefs.join(','))]
		});
	}

	updateSummary(args: { envID?: EnvironmentID } = {}): Promise<ImageUpdateSummary> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'image-updates/summary'));
	}
}
