/**
 * In-flight request deduplication for API GET responses. Port of
 * `ResponseCache.swift`: concurrent callers for the same key share one
 * network request; every call that starts after the previous one finished
 * gets a fresh response. Nothing is stored after a request completes, so a
 * stale value can never be served.
 */
export type CacheKey = {
	/** Canonical scheme + host + effective port + base path. */
	serverIdentity: string;
	/** `currentUser?.id ?? "anon"` (multi-account safety). */
	userID: string;
	/** Rotates for every authenticated session. */
	sessionIdentity: string;
	/** Active environment raw value. */
	envID: string;
	pathWithQuery: string;
};

export class CancellationError extends Error {
	constructor() {
		super('Cancelled');
		this.name = 'CancellationError';
	}
}

/** A shared validity lease; callers can check freshness before applying a result. */
export class CacheGeneration {
	private valid = true;
	get isValid() {
		return this.valid;
	}
	invalidate() {
		this.valid = false;
	}
}

type InFlight = {
	id: number;
	generation: CacheGeneration;
	controller: AbortController;
	promise: Promise<unknown>;
};

const keyString = (key: CacheKey) =>
	[key.serverIdentity, key.userID, key.sessionIdentity, key.envID, key.pathWithQuery].join(
		'\u0000'
	);

class ResponseCacheImpl {
	private inFlight = new Map<string, { key: CacheKey; request: InFlight }>();
	private nextID = 0;

	/** The lease of the request currently in flight for `key`, or a new one. */
	generation(key: CacheKey): CacheGeneration {
		return this.inFlight.get(keyString(key))?.request.generation ?? new CacheGeneration();
	}

	/**
	 * Cancels matching in-flight requests so the next caller starts a fresh one
	 * instead of joining a request that predates a mutation.
	 */
	invalidate(predicate: (key: CacheKey) => boolean) {
		for (const [id, entry] of this.inFlight) {
			if (!predicate(entry.key)) continue;
			this.inFlight.delete(id);
			entry.request.generation.invalidate();
			entry.request.controller.abort();
		}
	}

	invalidateEnvironment(envID: string) {
		this.invalidate((key) => key.envID === envID);
	}

	invalidateAll() {
		this.invalidate(() => true);
	}

	/** `work` receives an AbortSignal that fires when the request is invalidated. */
	async coalesce<T>(
		key: CacheKey,
		work: (signal: AbortSignal) => Promise<T>,
		generation?: CacheGeneration
	): Promise<T> {
		const id = keyString(key);
		const existing = this.inFlight.get(id)?.request;
		let request: InFlight;
		if (existing && (generation === undefined || existing.generation === generation)) {
			request = existing;
		} else {
			const lease = generation ?? new CacheGeneration();
			if (!lease.isValid) throw new CancellationError();
			const controller = new AbortController();
			request = {
				id: this.nextID++,
				generation: lease,
				controller,
				promise: work(controller.signal)
			};
			this.inFlight.set(id, { key, request });
		}
		try {
			const value = await request.promise;
			if (!request.generation.isValid) throw new CancellationError();
			return value as T;
		} finally {
			if (this.inFlight.get(id)?.request.id === request.id) this.inFlight.delete(id);
		}
	}
}

export const ResponseCache = new ResponseCacheImpl();
