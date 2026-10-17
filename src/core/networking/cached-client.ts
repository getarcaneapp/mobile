import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { Decoder } from '@/sdk/models/base/decoding';

import { PaginationLoader, type FetchPage, type Identifiable } from './pagination-loader';
import { RemoteDataLimits } from './remote-data-limits';
import { ResponseCache, type CacheKey } from './response-cache';

export function lenientArray<E>(raw: unknown, decode?: Decoder<E>): E[] {
	if (!Array.isArray(raw)) throw new Error('Expected an array');
	if (raw.length > RemoteDataLimits.maximumCollectionItems)
		throw new Error('Array exceeds the supported item limit');
	const elements: E[] = [];
	raw.forEach((item, index) => {
		try {
			elements.push(decode ? decode(item) : (item as E));
		} catch (error) {
			if (__DEV__) console.warn(`Skipping malformed element at index ${index}: ${String(error)}`);
		}
	});
	return elements;
}

export class CachedClient {
	static readonly globalEnvironment: EnvironmentID = '_global_';

	constructor(
		readonly client: ArcaneClient,
		readonly serverIdentity: string,
		readonly userID: string,
		readonly sessionIdentity: string
	) {}

	get<T>(path: string, envID: EnvironmentID, decode?: Decoder<T>): Promise<T> {
		return this.getCustom(path, envID, (signal) =>
			this.client.withSignal(signal).rest.get<T>(path, { decode })
		);
	}

	getGlobal<T>(path: string, decode?: Decoder<T>): Promise<T> {
		return this.get(path, CachedClient.globalEnvironment, decode);
	}

	getList<E>(path: string, envID: EnvironmentID, decode?: Decoder<E>): Promise<E[]> {
		return this.getCustom(path, envID, (signal) =>
			this.client
				.withSignal(signal)
				.rest.get<unknown>(path)
				.then((raw) => lenientArray(raw, decode))
		);
	}

	getListGlobal<E>(path: string, decode?: Decoder<E>): Promise<E[]> {
		return this.getList(path, CachedClient.globalEnvironment, decode);
	}

	getAllPages<E extends Identifiable>(
		path: string,
		envID: EnvironmentID,
		fetchPage: FetchPage<E>,
		options: { pageSize?: number; maximumItems?: number } = {}
	): Promise<E[]> {
		return this.getCustom(PaginationLoader.cachePath(path), envID, () =>
			PaginationLoader.collect(fetchPage, options)
		);
	}

	getAllPagesGlobal<E extends Identifiable>(
		path: string,
		fetchPage: FetchPage<E>,
		options: { pageSize?: number; maximumItems?: number } = {}
	): Promise<E[]> {
		return this.getAllPages(path, CachedClient.globalEnvironment, fetchPage, options);
	}

	getCustom<T>(
		path: string,
		envID: EnvironmentID,
		fetcher: (signal: AbortSignal) => Promise<T>
	): Promise<T> {
		if (__DEV__ && (path.endsWith('/stats') || path.endsWith('/logs'))) {
			throw new Error(`ResponseCache must not be used for stream paths: ${path}`);
		}
		const key: CacheKey = {
			serverIdentity: this.serverIdentity,
			userID: this.userID,
			sessionIdentity: this.sessionIdentity,
			envID,
			pathWithQuery: path
		};
		return ResponseCache.coalesce(key, fetcher);
	}

	invalidate(envID: EnvironmentID, paths: string[]) {
		ResponseCache.invalidate(
			(key) =>
				key.serverIdentity === this.serverIdentity &&
				key.userID === this.userID &&
				key.sessionIdentity === this.sessionIdentity &&
				key.envID === envID &&
				paths.some((pattern) => CachedClient.matches(pattern, key.pathWithQuery))
		);
	}

	invalidateGlobal(paths: string[]) {
		ResponseCache.invalidate(
			(key) =>
				key.serverIdentity === this.serverIdentity &&
				key.userID === this.userID &&
				key.sessionIdentity === this.sessionIdentity &&
				paths.some((pattern) => CachedClient.matches(pattern, key.pathWithQuery))
		);
	}

	static matches(pattern: string, path: string): boolean {
		if (pattern === path || path.startsWith(pattern + '?') || path.startsWith(pattern + '#'))
			return true;
		if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1));
		return false;
	}
}
