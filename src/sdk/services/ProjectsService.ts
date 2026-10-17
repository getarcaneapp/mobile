/**
 * Port of Services/ProjectsService.swift.
 *
 * ProjectsService exposes Docker Compose project management endpoints
 * registered under `/environments/{id}/projects`.
 *
 * The HTTP-streaming endpoints (`deploy`, `redeploy`, `build`, `pullImages`)
 * issue the request and block until the operation's terminal frame. Their
 * corresponding stream methods expose progress line-by-line.
 */
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

/** Swift `URL(fileURLWithPath: path).lastPathComponent`. */
function lastPathComponent(path: string): string {
	const trimmed = path.replace(/\/+$/, '');
	if (trimmed === '') return path.startsWith('/') ? '/' : '';
	return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

/** Swift `encodeOrNil(_:)`: JSON-encodes the body, or sends none. */
function encodeOrNil(value: object | undefined): string | undefined {
	return value === undefined ? undefined : encodeArcaneJSON(value);
}

async function drain(stream: AsyncIterable<unknown>): Promise<void> {
	for await (const _ of stream) {
		// Wait for the terminal frame.
	}
}

export class ProjectsService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	// MARK: - Listing

	/** Paginated list of projects on the environment. */
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

	/** Aggregate counts of projects by status. */
	statusCounts(args: { envID?: EnvironmentID } = {}): Promise<ProjectStatusCounts> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'projects/counts'));
	}

	// MARK: - Single project read

	/** Get a single project by ID (no extra detail flags). */
	get(args: { envID?: EnvironmentID; projectID: string }): Promise<ProjectDetails> {
		return this.rest.get(this.rest.environmentPath(args.envID, `projects/${args.projectID}`), {
			decode: ProjectDetails.decode
		});
	}

	/** Get the project compose details (compose content, includes, configs). */
	compose(args: { envID?: EnvironmentID; projectID: string }): Promise<ProjectDetails> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/compose`),
			{
				decode: ProjectDetails.decode
			}
		);
	}

	/** Get the project's on-disk directory files. */
	files(args: { envID?: EnvironmentID; projectID: string }): Promise<ProjectDetails> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/files`),
			{
				decode: ProjectDetails.decode
			}
		);
	}

	/**
	 * Get the project's editable workspace file tree.
	 *
	 * Arcane 2.8 moved project files under `/workspace`. The legacy fallback
	 * keeps older v1 and v2 servers viewable through the same SDK surface.
	 */
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

	/** Get the project's runtime service state. */
	runtime(args: { envID?: EnvironmentID; projectID: string }): Promise<ProjectDetails> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/runtime`),
			{
				decode: ProjectDetails.decode
			}
		);
	}

	/** Get the project's image update summary. */
	updates(args: { envID?: EnvironmentID; projectID: string }): Promise<ProjectDetails> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/updates`),
			{
				decode: ProjectDetails.decode
			}
		);
	}

	/** Get the contents of a single project-related file by relative path. */
	file(args: {
		envID?: EnvironmentID;
		projectID: string;
		relativePath: string;
	}): Promise<IncludeFile> {
		return this.rest.get(this.rest.environmentPath(args.envID, `projects/${args.projectID}/file`), {
			query: [q('relativePath', args.relativePath)]
		});
	}

	/**
	 * Get the contents and editability metadata for one project workspace file.
	 * Falls back to the pre-2.8 project file route when `/workspace/file` is absent.
	 */
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

	/**
	 * Apply project workspace file changes.
	 *
	 * Current servers accept a multipart workspace manifest with file contents
	 * as indexed uploads. Older servers receive their original JSON update
	 * payload through the legacy project endpoint.
	 */
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

	// MARK: - Mutations

	/**
	 * Create a new Docker Compose project.
	 *
	 * Arcane 2.8+ takes multipart/form-data (mirrors the web UI's
	 * `projectService.createProject`): a `project` JSON part with the name and
	 * compose/.env content, a `manifest` JSON part listing extra workspace files,
	 * and one `files` upload per created file (matched by `uploadIndex`). Older
	 * servers reject multipart with 415 and get their original JSON body.
	 */
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

	/** @internal The multipart parts for `create` (exposed for tests). */
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

	/** Update a project's name and/or compose/env content. */
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

	/**
	 * Update a single include file inside a project.
	 *
	 * @deprecated Arcane 2.8+ removed `PUT …/includes` (404); use `updateWorkspace`.
	 */
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

	/**
	 * Swift writes each file to a 0600 temp file and streams it; here the
	 * content is uploaded from memory as a UTF-8 part.
	 */
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

	// MARK: - Lifecycle

	/**
	 * Deploy a project (docker compose up).
	 *
	 * The server streams NDJSON progress; this call resolves only when the
	 * deploy is fully complete. Use `deployStream` for live progress.
	 */
	async deploy(args: {
		envID?: EnvironmentID;
		projectID: string;
		options?: DeployOptions;
	}): Promise<void> {
		await drain(this.deployStream(args));
	}

	/** Bring down a project (docker compose down). */
	down(args: { envID?: EnvironmentID; projectID: string }): Promise<MessageResponse> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/down`),
			{
				decode: MessageResponse.decode
			}
		);
	}

	/** Redeploy a project (down + up). */
	async redeploy(args: { envID?: EnvironmentID; projectID: string }): Promise<void> {
		await drain(this.redeployStream(args));
	}

	/** Restart all containers in a project, or only the supplied Compose services. */
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

	/**
	 * Destroy a project, optionally removing files and/or volumes.
	 * Options are encoded in the DELETE body to preserve the server's safety contract.
	 */
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

	/** Archive a project (project must be stopped). */
	archive(args: { envID?: EnvironmentID; projectID: string }): Promise<void> {
		return this.rest.postVoid(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/archive`)
		);
	}

	/** Unarchive a project. */
	unarchive(args: { envID?: EnvironmentID; projectID: string }): Promise<void> {
		return this.rest.postVoid(
			this.rest.environmentPath(args.envID, `projects/${args.projectID}/unarchive`)
		);
	}

	/**
	 * Pull all images for a project. The server streams progress as NDJSON;
	 * the call resolves once the pull is complete. Use `pullImagesStream`
	 * for live progress.
	 */
	async pullImages(args: {
		envID?: EnvironmentID;
		projectID: string;
		request?: ImagePullRequest;
	}): Promise<void> {
		await drain(this.pullImagesStream(args));
	}

	/**
	 * Build compose services that declare a `build` directive. The server
	 * streams build progress as NDJSON; this call resolves once the build is
	 * complete. Use `buildStream` for live progress.
	 */
	async build(args: {
		envID?: EnvironmentID;
		projectID: string;
		request?: BuildProjectRequest;
	}): Promise<void> {
		await drain(this.buildStream(args));
	}

	// MARK: - NDJSON progress streams

	/** Deploy a project and stream NDJSON progress events. */
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

	/** Redeploy a project and stream NDJSON progress events. */
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

	/** Pull a project's images and stream NDJSON progress events. */
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

	/** Build a project's images and stream NDJSON progress events. */
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

	// MARK: - Streaming

	/** Stream project logs over WebSocket. */
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
