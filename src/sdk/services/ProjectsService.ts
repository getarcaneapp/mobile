import type { EnvironmentID } from '../client/environment';
import { q } from '../client/url';
import { ArcaneError, isArcaneError } from '../errors/ArcaneError';
import { encodeArcaneJSON, encodeUTF8 } from '../http/json';
import type { MultipartFile } from '../http/multipart';
import type { RESTService } from '../http/RESTService';
import { MessageResponse } from '../models/base/message';
import { SearchPaginationSort } from '../models/base/pagination';
import {
	ProjectCreateResponse,
	ProjectDetails,
	type BuildProjectRequest,
	type CreateProject,
	type DeployOptions,
	type DestroyProject,
	type ImagePullRequest,
	type IncludeFile,
	type ProjectStatusCounts,
	type UpdateIncludeFile,
	type UpdateProject
} from '../models/project/Project';
import {
	ProjectWorkspace,
	type ProjectFileChange,
	type ProjectFileChangeOperation,
	type ProjectWorkspaceFileContent
} from '../models/project/ProjectFiles';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';
import { NDJSONStream } from '../streaming/NDJSONStream';
import { LogStream } from '../streaming/Streams';
import { OperationStreamEvent } from '../types/streaming/OperationStreamEvent';

interface ProjectWorkspaceUpdateManifest {
	fileTreeRevision: string;
	fileChanges: ProjectWorkspaceManifestChange[];
}

interface ProjectWorkspaceManifestChange {
	operation: ProjectFileChangeOperation;
	relativePath: string;
	newName?: string;
	newParentPath?: string;
	uploadIndex?: number;
	recursive?: boolean;
}

function lastPathComponent(path: string): string {
	const trimmed = path.replace(/\/+$/, '');
	if (trimmed === '') return path.startsWith('/') ? '/' : '';
	return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

function encodeOrNil(value: object | undefined): string | undefined {
	return value === undefined ? undefined : encodeArcaneJSON(value);
}

async function drain(stream: AsyncIterable<unknown>): Promise<void> {
	for await (const _ of stream) {
	}
}

export class ProjectsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	list(
		args: {
			envID?: EnvironmentID;
			query?: SearchPaginationSort;
			status?: string;
			updates?: string;
			archived?: string;
			tags?: string;
			label?: string;
		} = {}
	): Promise<PaginatedResponse<ProjectDetails>> {
		const query = args.query ?? {};
		const items = SearchPaginationSort.nonPaginationQueryItems(query);
		if (args.status !== undefined) items.push(q('status', args.status));
		if (args.updates !== undefined) items.push(q('updates', args.updates));
		if (args.archived !== undefined) items.push(q('archived', args.archived));
		if (args.tags !== undefined) items.push(q('tags', args.tags));
		if (args.label !== undefined) items.push(q('label', args.label));
		return this.rest.paginated(this.rest.environmentPath(args.envID, 'projects'), {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: items,
			decode: ProjectDetails.decode
		});
	}

	statusCounts(args: { envID?: EnvironmentID } = {}): Promise<ProjectStatusCounts> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'projects/counts'));
	}

	get(args: { envID?: EnvironmentID; projectID: string }): Promise<ProjectDetails> {
		return this.rest.get(this.rest.environmentPath(args.envID, `projects/${args.projectID}`), {
			decode: ProjectDetails.decode
		});
	}

	compose(args: { envID?: EnvironmentID; projectID: string }): Promise<ProjectDetails> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/compose`),
			{
				decode: ProjectDetails.decode
			}
		);
	}

	files(args: { envID?: EnvironmentID; projectID: string }): Promise<ProjectDetails> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/files`),
			{
				decode: ProjectDetails.decode
			}
		);
	}

	async workspace(args: { envID?: EnvironmentID; projectID: string }): Promise<ProjectWorkspace> {
		try {
			return await this.rest.get(
				this.rest.environmentPath(args.envID, `projects/${args.projectID}/workspace`),
				{ decode: ProjectWorkspace.decode }
			);
		} catch (error) {
			if (!isArcaneError(error, 'notFound')) throw error;
			const legacy = await this.files({ envID: args.envID, projectID: args.projectID });
			return ProjectWorkspace.make({
				files: legacy.projectFiles ?? [],
				fileTreeRevision: legacy.fileTreeRevision ?? ''
			});
		}
	}

	runtime(args: { envID?: EnvironmentID; projectID: string }): Promise<ProjectDetails> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/runtime`),
			{
				decode: ProjectDetails.decode
			}
		);
	}

	updates(args: { envID?: EnvironmentID; projectID: string }): Promise<ProjectDetails> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/updates`),
			{
				decode: ProjectDetails.decode
			}
		);
	}

	file(args: {
		envID?: EnvironmentID;
		projectID: string;
		relativePath: string;
	}): Promise<IncludeFile> {
		return this.rest.get(this.rest.environmentPath(args.envID, `projects/${args.projectID}/file`), {
			query: [q('relativePath', args.relativePath)]
		});
	}

	async workspaceFile(args: {
		envID?: EnvironmentID;
		projectID: string;
		relativePath: string;
	}): Promise<ProjectWorkspaceFileContent> {
		try {
			return await this.rest.get<ProjectWorkspaceFileContent>(
				this.rest.environmentPath(args.envID, `projects/${args.projectID}/workspace/file`),
				{ query: [q('relativePath', args.relativePath)] }
			);
		} catch (error) {
			if (!isArcaneError(error, 'notFound')) throw error;
			const legacy = await this.file(args);
			return {
				path: legacy.path,
				relativePath: legacy.relativePath,
				name: lastPathComponent(legacy.relativePath),
				content: legacy.content,
				size: 0,
				editable: true
			};
		}
	}

	async updateWorkspace(args: {
		envID?: EnvironmentID;
		projectID: string;
		fileTreeRevision: string | undefined;
		changes: ProjectFileChange[];
	}): Promise<ProjectWorkspace> {
		try {
			return await this.updateCurrentWorkspace({
				envID: args.envID,
				projectID: args.projectID,
				fileTreeRevision: args.fileTreeRevision ?? '',
				changes: args.changes
			});
		} catch (error) {
			if (!isArcaneError(error, 'notFound')) throw error;
			const legacy = await this.update({
				envID: args.envID,
				projectID: args.projectID,
				request: { fileTreeRevision: args.fileTreeRevision, fileChanges: args.changes }
			});
			return ProjectWorkspace.make({
				files: legacy.projectFiles ?? [],
				fileTreeRevision: legacy.fileTreeRevision ?? args.fileTreeRevision ?? ''
			});
		}
	}

	async create(args: {
		envID?: EnvironmentID;
		request: CreateProject;
	}): Promise<ProjectCreateResponse> {
		const path = this.rest.environmentPath(args.envID, 'projects');
		const { fields, files } = ProjectsService.createMultipartParts(args.request);
		try {
			return await this.rest.transport.multipartUpload(path, {
				method: 'POST',
				fields,
				files,
				decode: ProjectCreateResponse.decode
			});
		} catch (error) {
			const unsupportedMediaType =
				(isArcaneError(error, 'server') && error.code === 'HTTP_415') ||
				(isArcaneError(error, 'unknown') && error.statusCode === 415);
			if (!unsupportedMediaType) throw error;
			return this.rest.post(path, { body: args.request, decode: ProjectCreateResponse.decode });
		}
	}

	static createMultipartParts(request: CreateProject): {
		fields: { project: string; manifest: string };
		files: MultipartFile[];
	} {
		const files: MultipartFile[] = [];
		const fileChanges: ProjectWorkspaceManifestChange[] = (request.projectFiles ?? []).map(
			(draft) => {
				if (draft.isDirectory) {
					return { operation: 'create_folder', relativePath: draft.relativePath };
				}
				const uploadIndex = files.length;
				const filename = lastPathComponent(draft.relativePath);
				files.push({
					fieldName: 'files',
					filename: filename === '' ? 'file' : filename,
					contentType: 'text/plain; charset=utf-8',
					data: encodeUTF8(draft.content ?? '')
				});
				return { operation: 'create_file', relativePath: draft.relativePath, uploadIndex };
			}
		);
		let project: string;
		let manifest: string;
		try {
			project = encodeArcaneJSON({
				name: request.name,
				composeContent: request.composeContent,
				envContent: request.envContent
			});
			manifest = encodeArcaneJSON({ fileChanges });
		} catch {
			throw ArcaneError.decoding('Unable to encode project create request');
		}
		return { fields: { project, manifest }, files };
	}

	update(args: {
		envID?: EnvironmentID;
		projectID: string;
		request: UpdateProject;
	}): Promise<ProjectDetails> {
		return this.rest.put(this.rest.environmentPath(args.envID, `projects/${args.projectID}`), {
			body: args.request,
			decode: ProjectDetails.decode
		});
	}

	updateInclude(args: {
		envID?: EnvironmentID;
		projectID: string;
		request: UpdateIncludeFile;
	}): Promise<ProjectDetails> {
		return this.rest.put(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/includes`),
			{
				body: args.request,
				decode: ProjectDetails.decode
			}
		);
	}

	private updateCurrentWorkspace(args: {
		envID: EnvironmentID | undefined;
		projectID: string;
		fileTreeRevision: string;
		changes: ProjectFileChange[];
	}): Promise<ProjectWorkspace> {
		const manifestChanges: ProjectWorkspaceManifestChange[] = [];
		const uploads: MultipartFile[] = [];
		for (const change of args.changes) {
			let uploadIndex: number | undefined;
			if (change.operation === 'create_file' || change.operation === 'update_file') {
				if (change.content === undefined) {
					throw ArcaneError.validation({
						fileChanges: ['File content is required for create and update operations.']
					});
				}
				uploadIndex = uploads.length;
				const filename = lastPathComponent(change.relativePath);
				uploads.push({
					fieldName: 'files',
					filename: filename === '' ? 'file' : filename,
					contentType: 'text/plain; charset=utf-8',
					data: encodeUTF8(change.content)
				});
			}
			manifestChanges.push({
				operation: change.operation,
				relativePath: change.relativePath,
				newName: change.newName,
				newParentPath: change.newParentPath,
				uploadIndex,
				recursive: change.recursive
			});
		}

		const manifest: ProjectWorkspaceUpdateManifest = {
			fileTreeRevision: args.fileTreeRevision,
			fileChanges: manifestChanges
		};
		let manifestJSON: string;
		try {
			manifestJSON = encodeArcaneJSON(manifest);
		} catch {
			throw ArcaneError.decoding('Unable to encode project workspace manifest');
		}

		return this.rest.transport.multipartUpload(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/workspace`),
			{
				method: 'PUT',
				fields: { manifest: manifestJSON },
				files: uploads,
				decode: ProjectWorkspace.decode
			}
		);
	}

	async deploy(args: {
		envID?: EnvironmentID;
		projectID: string;
		options?: DeployOptions;
	}): Promise<void> {
		await drain(this.deployStream(args));
	}

	down(args: { envID?: EnvironmentID; projectID: string }): Promise<MessageResponse> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/down`),
			{
				decode: MessageResponse.decode
			}
		);
	}

	async redeploy(args: { envID?: EnvironmentID; projectID: string }): Promise<void> {
		await drain(this.redeployStream(args));
	}

	restart(args: {
		envID?: EnvironmentID;
		projectID: string;
		services?: string[];
	}): Promise<MessageResponse> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/restart`),
			{
				query: (args.services ?? []).map((service) => q('services', service)),
				decode: MessageResponse.decode
			}
		);
	}

	destroy(args: {
		envID?: EnvironmentID;
		projectID: string;
		options?: DestroyProject;
	}): Promise<MessageResponse> {
		return this.rest.transport.request(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/destroy`),
			{ method: 'DELETE', body: args.options, decode: MessageResponse.decode }
		);
	}

	archive(args: { envID?: EnvironmentID; projectID: string }): Promise<void> {
		return this.rest.postVoid(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/archive`)
		);
	}

	unarchive(args: { envID?: EnvironmentID; projectID: string }): Promise<void> {
		return this.rest.postVoid(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/unarchive`)
		);
	}

	async pullImages(args: {
		envID?: EnvironmentID;
		projectID: string;
		request?: ImagePullRequest;
	}): Promise<void> {
		await drain(this.pullImagesStream(args));
	}

	async build(args: {
		envID?: EnvironmentID;
		projectID: string;
		request?: BuildProjectRequest;
	}): Promise<void> {
		await drain(this.buildStream(args));
	}

	deployStream(args: {
		envID?: EnvironmentID;
		projectID: string;
		options?: DeployOptions;
	}): NDJSONStream<OperationStreamEvent> {
		return new NDJSONStream<OperationStreamEvent>(this.rest.transport, {
			path: this.rest.environmentPath(args.envID, `projects/${args.projectID}/up`),
			method: 'POST',
			body: encodeOrNil(args.options),
			terminalAction: OperationStreamEvent.terminalAction,
			decode: OperationStreamEvent.decode
		});
	}

	redeployStream(args: {
		envID?: EnvironmentID;
		projectID: string;
	}): NDJSONStream<OperationStreamEvent> {
		return new NDJSONStream<OperationStreamEvent>(this.rest.transport, {
			path: this.rest.environmentPath(args.envID, `projects/${args.projectID}/redeploy`),
			method: 'POST',
			terminalAction: OperationStreamEvent.terminalAction,
			decode: OperationStreamEvent.decode
		});
	}

	pullImagesStream(args: {
		envID?: EnvironmentID;
		projectID: string;
		request?: ImagePullRequest;
	}): NDJSONStream<OperationStreamEvent> {
		return new NDJSONStream<OperationStreamEvent>(this.rest.transport, {
			path: this.rest.environmentPath(args.envID, `projects/${args.projectID}/pull`),
			method: 'POST',
			body: encodeOrNil(args.request),
			terminalAction: OperationStreamEvent.terminalAction,
			decode: OperationStreamEvent.decode
		});
	}

	buildStream(args: {
		envID?: EnvironmentID;
		projectID: string;
		request?: BuildProjectRequest;
	}): NDJSONStream<OperationStreamEvent> {
		return new NDJSONStream<OperationStreamEvent>(this.rest.transport, {
			path: this.rest.environmentPath(args.envID, `projects/${args.projectID}/build`),
			method: 'POST',
			body: encodeOrNil(args.request),
			terminalAction: OperationStreamEvent.terminalAction,
			decode: OperationStreamEvent.decode
		});
	}

	logs(args: {
		envID?: EnvironmentID;
		projectID: string;
		follow?: boolean;
		tail?: string;
		since?: string;
		timestamps?: boolean;
	}): LogStream {
		return new LogStream(
			this.rest.transport,
			this.rest.environmentPath(args.envID, `ws/projects/${args.projectID}/logs`),
			LogStream.query(args.follow ?? true, args.tail ?? '200', args.since, args.timestamps ?? false)
		);
	}
}
