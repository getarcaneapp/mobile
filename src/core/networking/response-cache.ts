export type CacheKey = {
	serverIdentity: string;
	userID: string;
	sessionIdentity: string;
	envID: string;
	pathWithQuery: string;
};

export class CancellationError extends Error {
	constructor() {
		super('Cancelled');
		this.name = 'CancellationError';
	}
}

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

	generation(key: CacheKey): CacheGeneration {
		return this.inFlight.get(keyString(key))?.request.generation ?? new CacheGeneration();
	}

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
