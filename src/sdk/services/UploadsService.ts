/** Port of Services/UploadsService.swift. */
import type { EnvironmentID } from '../client/environment';
import { ArcaneError, CancellationError } from '../errors/ArcaneError';
import { decodeUTF8 } from '../http/json';
import type { RESTService } from '../http/RESTService';
import type {
	CreateUploadSession,
	UploadKind,
	UploadProgress,
	UploadSession
} from '../models/upload/UploadSession';

/**
 * Replacement for the Swift `fileURL` + `FileHandle` pair used by
 * `uploadFile`: the SDK has no file system, so the app supplies a random-access
 * reader (e.g. over an expo-file-system `File`). Use `UploadFileSource.fromBlob`
 * for any `Blob`.
 */
export interface UploadFileSource {
	/** Swift `fileURL.lastPathComponent`; sent as the session filename. */
	name: string;
	/** Total file size in bytes (Swift `file.seekToEnd()`). */
	size: number;
	/** Reads up to `count` bytes starting at `offset`. */
	read(offset: number, count: number): Promise<Uint8Array>;
}

export const UploadFileSource = {
	fromBlob(blob: Blob, name: string): UploadFileSource {
		return {
			name,
			size: blob.size,
			async read(offset, count) {
				return new Uint8Array(await blob.slice(offset, offset + count).arrayBuffer());
			}
		};
	}
} as const;

export class UploadsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	create(args: {
		envID?: EnvironmentID;
		kind: UploadKind;
		body: CreateUploadSession;
	}): Promise<UploadSession> {
		return this.rest.post(this.rest.environmentPath(args.envID, `uploads/${args.kind}`), {
			body: args.body
		});
	}

	get(args: { envID?: EnvironmentID; kind: UploadKind; id: string }): Promise<UploadSession> {
		return this.rest.get(this.rest.environmentPath(args.envID, `uploads/${args.kind}/${args.id}`));
	}

	async delete(args: { envID?: EnvironmentID; kind: UploadKind; id: string }): Promise<void> {
		await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, `uploads/${args.kind}/${args.id}`),
			{
				method: 'DELETE'
			}
		);
	}

	async putChunk(args: {
		envID?: EnvironmentID;
		kind: UploadKind;
		id: string;
		index: number;
		data: Uint8Array;
	}): Promise<UploadSession> {
		const response = await this.rest.transport.rawDataRequest(
			this.rest.environmentPath(args.envID, `uploads/${args.kind}/${args.id}/chunks/${args.index}`),
			{ body: args.data, expectsJSONResponse: true }
		);
		return this.rest.transport.decodeEnvelope<UploadSession>(decodeUTF8(response));
	}

	/**
	 * Reads one server-sized chunk at a time and returns the upload session ID.
	 * The completed session is consumed by a domain endpoint. The Swift
	 * `fileURL` argument is `file` (see `UploadFileSource`).
	 */
	async uploadFile(args: {
		envID?: EnvironmentID;
		kind: UploadKind;
		file: UploadFileSource;
		onProgress?: (progress: UploadProgress) => void | Promise<void>;
	}): Promise<string> {
		const { envID, kind, file } = args;
		const size = file.size;
		if (!(size > 0 && size <= Number.MAX_SAFE_INTEGER)) {
			throw ArcaneError.transport('Invalid upload file size');
		}
		const session = await this.create({ envID, kind, body: { filename: file.name, size } });
		let completed = false;
		try {
			if (
				!(session.chunkSize > 0 && session.chunkSize <= 64 * 1024 * 1024) ||
				session.size !== size ||
				session.totalChunks !== Math.floor((size - 1) / session.chunkSize) + 1
			) {
				throw ArcaneError.transport('Invalid upload session dimensions');
			}
			let received = new Set(session.receivedChunks);
			for (let index = 0; index < session.totalChunks; index += 1) {
				if (this.rest.transport.defaultSignal?.aborted) throw new CancellationError();
				if (!received.has(index)) {
					const offset = index * session.chunkSize;
					const count = Math.min(session.chunkSize, size - offset);
					const chunk = await file.read(offset, count);
					if (chunk.byteLength !== count) {
						throw ArcaneError.transport('Upload file changed while reading');
					}
					const updated = await this.putChunk({ envID, kind, id: session.id, index, data: chunk });
					received = new Set(updated.receivedChunks);
				}
				let bytesDone = 0;
				for (const chunkIndex of received) {
					if (chunkIndex >= 0 && chunkIndex < session.totalChunks) {
						bytesDone += Math.min(session.chunkSize, size - chunkIndex * session.chunkSize);
					}
				}
				await args.onProgress?.({ bytesDone, totalBytes: size });
			}
			const final = await this.get({ envID, kind, id: session.id });
			if (!final.complete) throw ArcaneError.transport('Upload session is incomplete');
			completed = true;
			return session.id;
		} finally {
			if (!completed) {
				// Swift `withCancellationRecovery`: clean up even when the caller's
				// signal was aborted, using a transport detached from that signal.
				await this.rest.transport
					.withSignal(new AbortController().signal)
					.rawRequest(this.rest.environmentPath(envID, `uploads/${kind}/${session.id}`), {
						method: 'DELETE'
					})
					.catch(() => undefined);
			}
		}
	}
}
