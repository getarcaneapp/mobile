/**
 * Port of `RemoteDataLimits.swift`: hard caps on what the app accepts from a
 * server, plus bounded body reads. Pure TS apart from the SDK client type.
 */
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { RequestBody } from '@/sdk/client/ArcaneTransport';
import { parseArcaneJSON } from '@/sdk/http/json';

export const RemoteDataLimits = {
	maximumCollectionItems: 10_000,
	maximumEnvironments: 250,
	maximumTopologyNodes: 500,
	maximumTopologyEdges: 2_000,
	maximumUpdaterItems: 500,
	maximumUpdaterStatusIDs: 200,
	maximumTemplateRegistries: 500,
	maximumResponseBytes: 8 * 1_024 * 1_024,
	maximumInspectBytes: 4 * 1_024 * 1_024,
	maximumTemplateBytes: 2 * 1_024 * 1_024,
	maximumImageBytes: 5 * 1_024 * 1_024,
	maximumStreamLineBytes: 16 * 1_024,
	maximumTerminalFrameBytes: 256 * 1_024
} as const;

/** Swift `ByteCountFormatter.string(fromByteCount:countStyle: .file)` (decimal units). */
export function formatFileBytes(bytes: number): string {
	// ByteCountFormatter spells out zero ("Zero KB") and singularizes one byte.
	if (bytes === 0) return 'Zero KB';
	if (bytes === 1) return '1 byte';
	if (bytes < 1_000) return `${bytes} bytes`;
	// Adaptive digits like ByteCountFormatter: KB 0, MB 1, GB and up 2 (trailing zeros
	// trimmed: "8.3 GB", "33.59 GB"); a value that rounds to 1000 rolls into the next unit.
	const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
	const digits = [0, 1, 2, 2, 2];
	let value = bytes / 1_000;
	let unit = 0;
	while (unit < units.length - 1 && Number(value.toFixed(digits[unit] ?? 2)) >= 1_000) {
		value /= 1_000;
		unit += 1;
	}
	const rounded = Number(value.toFixed(digits[unit] ?? 2)).toString();
	return `${rounded} ${units[unit]}`;
}

export type RemoteDataLimitErrorKind =
	| { kind: 'collectionTooLarge'; maximumItems: number }
	| { kind: 'responseTooLarge'; maximumBytes: number }
	| { kind: 'httpStatus'; status: number };

/** Port of `RemoteDataLimitError`; `message` is the Swift `errorDescription`. */
export class RemoteDataLimitError extends Error {
	readonly detail: RemoteDataLimitErrorKind;

	constructor(detail: RemoteDataLimitErrorKind) {
		super(RemoteDataLimitError.describe(detail));
		this.name = 'RemoteDataLimitError';
		this.detail = detail;
	}

	static collectionTooLarge(maximumItems: number) {
		return new RemoteDataLimitError({ kind: 'collectionTooLarge', maximumItems });
	}
	static responseTooLarge(maximumBytes: number) {
		return new RemoteDataLimitError({ kind: 'responseTooLarge', maximumBytes });
	}
	static httpStatus(status: number) {
		return new RemoteDataLimitError({ kind: 'httpStatus', status });
	}

	private static describe(detail: RemoteDataLimitErrorKind): string {
		switch (detail.kind) {
			case 'collectionTooLarge':
				return `The server returned more than the supported limit of ${detail.maximumItems} items.`;
			case 'responseTooLarge':
				return `The server response exceeded the ${formatFileBytes(detail.maximumBytes)} safety limit.`;
			case 'httpStatus':
				return `The server returned HTTP ${detail.status}.`;
		}
	}
}

export function isHTTPStatusError(error: unknown, status: number): boolean {
	return (
		error instanceof RemoteDataLimitError &&
		error.detail.kind === 'httpStatus' &&
		error.detail.status === status
	);
}

/** Port of `RemoteDataLimits.boundedData`: streams a body and stops at `maximumBytes`. */
export async function boundedData(
	client: ArcaneClient,
	path: string,
	options: {
		maximumBytes?: number;
		method?: string;
		body?: RequestBody;
		contentType?: string;
		authorized?: boolean;
		accept?: string;
		signal?: AbortSignal;
	} = {}
): Promise<Uint8Array> {
	const maximumBytes = options.maximumBytes ?? RemoteDataLimits.maximumResponseBytes;
	const result = await client.transport.byteStream(path, {
		method: options.method ?? 'GET',
		body: options.body,
		contentType: options.contentType,
		accept: options.accept ?? 'application/json',
		authorized: options.authorized ?? true,
		signal: options.signal
	});
	const status = result.http.status;
	if (status < 200 || status >= 300) {
		result.cancel();
		throw RemoteDataLimitError.httpStatus(status);
	}
	const declared = Number(result.http.headers.get('content-length') ?? -1);
	if (declared > maximumBytes) {
		result.cancel();
		throw RemoteDataLimitError.responseTooLarge(maximumBytes);
	}
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for await (const chunk of result.bytes) {
			total += chunk.byteLength;
			if (total > maximumBytes) throw RemoteDataLimitError.responseTooLarge(maximumBytes);
			chunks.push(chunk);
		}
	} catch (error) {
		result.cancel();
		throw error;
	}
	const data = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		data.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return data;
}

/** Port of `boundedAPIResponse`: bounded read of a `{ success, data }` envelope. */
export async function boundedAPIResponse<T>(
	client: ArcaneClient,
	path: string,
	options: { maximumBytes?: number; decode?: (raw: unknown) => T; signal?: AbortSignal } = {}
): Promise<T> {
	const data = await boundedData(client, path, {
		maximumBytes: options.maximumBytes,
		signal: options.signal
	});
	const envelope = parseArcaneJSON(new TextDecoder().decode(data)) as { data: unknown };
	return options.decode ? options.decode(envelope.data) : (envelope.data as T);
}

/** Port of `boundedDirectResponse`: bounded read of a bare JSON body. */
export async function boundedDirectResponse<T>(
	client: ArcaneClient,
	path: string,
	options: { maximumBytes?: number; decode?: (raw: unknown) => T; signal?: AbortSignal } = {}
): Promise<T> {
	const data = await boundedData(client, path, {
		maximumBytes: options.maximumBytes,
		signal: options.signal
	});
	const raw = parseArcaneJSON(new TextDecoder().decode(data));
	return options.decode ? options.decode(raw) : (raw as T);
}

/** Port of `boundedText`: truncates to `maximumBytes` UTF-8 bytes with a marker. */
export function boundedText(text: string, maximumBytes: number): string {
	const encoder = new TextEncoder();
	if (maximumBytes <= 0) return '';
	if (encoder.encode(text).byteLength <= maximumBytes) return text;
	const marker = '\n… output truncated …';
	const contentLimit = Math.max(0, maximumBytes - encoder.encode(marker).byteLength);
	let used = 0;
	let result = '';
	for (const character of text) {
		const bytes = encoder.encode(character).byteLength;
		if (used + bytes > contentLimit) break;
		result += character;
		used += bytes;
	}
	return result + marker;
}

export function nonnegative(value: number, maximum = 1_000_000_000): number {
	return Math.min(Math.max(value, 0), maximum);
}

export function saturatingAdd(lhs: number, rhs: number, maximum = 1_000_000_000): number {
	return Math.min(nonnegative(lhs, maximum) + nonnegative(rhs, maximum), maximum);
}
