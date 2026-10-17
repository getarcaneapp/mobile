import { CancellationError } from '../errors/ArcaneError';
import type { FetchInitLike, FetchLike, FetchResponseLike } from './fetching';
import { encodeUTF8 } from './json';
import { singleURIPartUpload } from './multipart';

type ExpoFileSystemLegacy = typeof import('expo-file-system/legacy');
const legacyFileSystem = () => require('expo-file-system/legacy') as ExpoFileSystemLegacy;

const uploadMethods = new Set(['POST', 'PUT', 'PATCH']);

function lastPathComponent(uri: string): string {
	const path = uri.split(/[?#]/)[0] ?? uri;
	const name = path.slice(path.lastIndexOf('/') + 1);
	try {
		return decodeURIComponent(name);
	} catch {
		return name;
	}
}

async function stagedFileURI(
	uri: string,
	filename: string
): Promise<{ uri: string; cleanup: () => Promise<void> }> {
	if (uri.startsWith('file:') && lastPathComponent(uri) === filename)
		return { uri, cleanup: async () => undefined };
	const { cacheDirectory, copyAsync, deleteAsync, getInfoAsync, makeDirectoryAsync } =
		legacyFileSystem();
	if (!cacheDirectory) throw new Error('No cache directory available to stage the upload.');
	const directory = `${cacheDirectory}arcane-upload-${Date.now()}-${Math.random().toString(36).slice(2)}/`;
	const cleanup = async () => {
		await deleteAsync(directory, { idempotent: true }).catch(() => undefined);
	};
	try {
		await makeDirectoryAsync(directory, { intermediates: true });
		const staged = directory + encodeURIComponent(filename.replace(/\//g, '_'));
		await copyAsync({ from: uri, to: staged });
		if (!(await getInfoAsync(staged)).exists)
			throw new Error(`Couldn't read "${filename}" for upload.`);
		return { uri: staged, cleanup };
	} catch (error) {
		await cleanup();
		throw error;
	}
}

function response(
	url: string,
	status: number,
	headers: Record<string, string>,
	body: string
): FetchResponseLike {
	return {
		status,
		url,
		headers: new Headers(headers),
		body: null,
		text: async () => body,
		arrayBuffer: async () => {
			const bytes = encodeUTF8(body);
			return bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength
			) as ArrayBuffer;
		}
	};
}

export function withStreamingUploads(base: FetchLike): FetchLike {
	return async (input: string, init?: FetchInitLike) => {
		const method = (init?.method ?? 'GET').toUpperCase();
		const upload = uploadMethods.has(method) ? singleURIPartUpload(init?.body) : undefined;
		if (!upload) return base(input, init);

		const signal = init?.signal;
		if (signal?.aborted) throw new CancellationError();
		const headers = Object.fromEntries(
			Object.entries(init?.headers ?? {}).filter(([name]) => name.toLowerCase() !== 'content-type')
		);
		const { createUploadTask, FileSystemSessionType, FileSystemUploadType } = legacyFileSystem();
		const staged = await stagedFileURI(upload.uri, upload.filename);
		const task = createUploadTask(input, staged.uri, {
			httpMethod: method as 'POST' | 'PUT' | 'PATCH',
			uploadType: FileSystemUploadType.MULTIPART,
			fieldName: upload.fieldName,
			mimeType: upload.type,
			parameters: upload.fields,
			headers,
			sessionType: FileSystemSessionType.FOREGROUND
		} as Parameters<ExpoFileSystemLegacy['createUploadTask']>[2]);
		const onAbort = () => void task.cancelAsync().catch(() => undefined);
		signal?.addEventListener('abort', onAbort, { once: true });
		try {
			const result = await task.uploadAsync();
			if (!result || signal?.aborted) throw new CancellationError();
			return response(input, result.status, result.headers, result.body);
		} catch (error) {
			if (signal?.aborted) throw new CancellationError();
			throw error;
		} finally {
			signal?.removeEventListener('abort', onAbort);
			await staged.cleanup();
		}
	};
}
