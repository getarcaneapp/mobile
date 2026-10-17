import type { ArcaneAuthorizedRequest } from '../client/ArcaneTransport';
import type { EnvironmentID } from '../client/environment';
import { q } from '../client/url';
import type { MultipartFile } from '../http/multipart';
import type { RESTService } from '../http/RESTService';
import { MessageResponse } from '../models/base/message';
import type { BuildFileContent } from '../models/builds/BuildWorkspace';
import type { FileEntry } from '../models/volume/Browse';

function lastPathComponent(uri: string): string {
	const path = uri.replace(/[?#].*$/, '').replace(/\/+$/, '');
	const component = path.slice(path.lastIndexOf('/') + 1);
	try {
		return decodeURIComponent(component);
	} catch {
		return component;
	}
}

export class BuildsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	browse(args: { path?: string; envID?: EnvironmentID } = {}): Promise<FileEntry[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'builds/browse'), {
			query: [q('path', args.path ?? '/')]
		});
	}

	getFileContent(args: {
		path: string;
		maxBytes?: number;
		envID?: EnvironmentID;
	}): Promise<BuildFileContent> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'builds/browse/content'), {
			query: [q('path', args.path), q('maxBytes', String(args.maxBytes ?? 1_048_576))]
		});
	}

	createDirectory(args: { path: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'builds/browse/mkdir'), {
			query: [q('path', args.path)]
		});
	}

	delete(args: { path: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(this.rest.environmentPath(args.envID, 'builds/browse'), {
			query: [q('path', args.path)]
		});
	}

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

	downloadFile(args: { path: string; envID?: EnvironmentID }): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw(
			this.rest.environmentPath(args.envID, 'builds/browse/download'),
			{
				query: [q('path', args.path)]
			}
		);
	}

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
