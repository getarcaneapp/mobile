/** Port of Services/BuildsService.swift. */
import type { ArcaneAuthorizedRequest } from '../client/ArcaneTransport';
import type { EnvironmentID } from '../client/environment';
import { q } from '../client/url';
import type { MultipartFile } from '../http/multipart';
import type { RESTService } from '../http/RESTService';
import { MessageResponse } from '../models/base/message';
import type { BuildFileContent } from '../models/builds/BuildWorkspace';
import type { FileEntry } from '../models/volume/Browse';

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

/** BuildsService browses files in the build workspace for an environment. */
export class BuildsService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** List files and directories under the builds workspace root. */
	browse(args: { path?: string; envID?: EnvironmentID } = {}): Promise<FileEntry[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'builds/browse'), {
			query: [q('path', args.path ?? '/')]
		});
	}

	/** Read file content under the builds workspace root. */
	getFileContent(args: {
		path: string;
		maxBytes?: number;
		envID?: EnvironmentID;
	}): Promise<BuildFileContent> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'builds/browse/content'), {
			query: [q('path', args.path), q('maxBytes', String(args.maxBytes ?? 1_048_576))]
		});
	}

	/** Create a directory under the builds workspace root. */
	createDirectory(args: { path: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'builds/browse/mkdir'), {
			query: [q('path', args.path)]
		});
	}

	/** Delete a file or directory under the builds workspace root. */
	delete(args: { path: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(this.rest.environmentPath(args.envID, 'builds/browse'), {
			query: [q('path', args.path)]
		});
	}

	/** Upload a file into the build workspace at `path`. `fileURL` is a local file URI. */
	async upload(args: {
		path: string;
		fileURL: string;
		filename?: string;
		envID?: EnvironmentID;
	}): Promise<void> {
		const part: MultipartFile = {
			fieldName: 'file',
			filename: args.filename ?? lastPathComponent(args.fileURL),
			uri: args.fileURL
		};
		await this.rest.transport.multipartUpload(
			this.rest.environmentPath(args.envID, 'builds/browse/upload'),
			{
				query: [q('path', args.path)],
				files: [part],
				decode: MessageResponse.decode
			}
		);
	}

	/**
	 * Consume a completed chunked build-workspace upload session.
	 * Swift `upload(path:uploadID:envID:)`.
	 */
	uploadFromSession(args: {
		path: string;
		uploadID: string;
		envID?: EnvironmentID;
	}): Promise<void> {
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'builds/browse/upload'), {
			body: { uploadId: args.uploadID },
			query: [q('path', args.path)]
		});
	}

	/**
	 * Download the raw bytes of a file in the build workspace.
	 * @deprecated Use `downloadFileDownloadRequest` for potentially large files.
	 */
	downloadFile(args: { path: string; envID?: EnvironmentID }): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw(
			this.rest.environmentPath(args.envID, 'builds/browse/download'),
			{
				query: [q('path', args.path)]
			}
		);
	}

	/**
	 * Replacement for Swift `downloadFile(path:envID:to:)`: authenticated URL +
	 * headers for streaming the file to disk with expo-file-system.
	 */
	downloadFileDownloadRequest(args: {
		path: string;
		envID?: EnvironmentID;
	}): Promise<ArcaneAuthorizedRequest> {
		return this.rest.transport.downloadRequest(
			this.rest.environmentPath(args.envID, 'builds/browse/download'),
			{
				query: [q('path', args.path)]
			}
		);
	}
}
