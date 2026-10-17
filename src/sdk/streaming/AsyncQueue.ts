export type BufferingPolicy = { kind: 'unbounded' } | { kind: 'bufferingNewest'; limit: number };

export const BufferingPolicy = {
	unbounded: { kind: 'unbounded' } as BufferingPolicy,
	bufferingNewest(limit: number): BufferingPolicy {
		return { kind: 'bufferingNewest', limit: Math.max(0, limit) };
	}
} as const;

export class AsyncQueue<T> implements AsyncIterable<T> {
	private readonly buffer: T[] = [];
	private waiters: { resolve: (r: IteratorResult<T>) => void; reject: (e: unknown) => void }[] = [];
	private finished = false;
	private failure: { error: unknown } | undefined;
	private readonly policy: BufferingPolicy;
	private readonly onTermination: (() => void) | undefined;
	private terminated = false;

	constructor(policy: BufferingPolicy = BufferingPolicy.unbounded, onTermination?: () => void) {
		this.policy = policy;
		this.onTermination = onTermination;
	}

	yield(value: T): void {
		if (this.finished) return;
		const waiter = this.waiters.shift();
		if (waiter) {
			waiter.resolve({ value, done: false });
			return;
		}
		this.buffer.push(value);
		if (this.policy.kind === 'bufferingNewest') {
			while (this.buffer.length > this.policy.limit) this.buffer.shift();
		}
	}

	finish(error?: unknown): void {
		if (this.finished) return;
		this.finished = true;
		if (error !== undefined) this.failure = { error };
		const waiters = this.waiters;
		this.waiters = [];
		for (const waiter of waiters) {
			if (this.failure && this.buffer.length === 0) waiter.reject(this.failure.error);
			else waiter.resolve({ value: undefined, done: true });
		}
		if (this.buffer.length === 0) this.terminate();
	}

	private terminate(): void {
		if (this.terminated) return;
		this.terminated = true;
		this.onTermination?.();
	}

	private next(): Promise<IteratorResult<T>> {
		if (this.buffer.length > 0) {
			const value = this.buffer.shift() as T;
			if (this.finished && this.buffer.length === 0 && !this.failure) this.terminate();
			return Promise.resolve({ value, done: false });
		}
		if (this.finished) {
			this.terminate();
			if (this.failure) {
				const { error } = this.failure;
				this.failure = undefined;
				return Promise.reject(error);
			}
			return Promise.resolve({ value: undefined, done: true });
		}
		return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
	}

	[Symbol.asyncIterator](): AsyncIterator<T> {
		return {
			next: () => this.next(),
			return: async () => {
				this.finished = true;
				this.buffer.length = 0;
				this.failure = undefined;
				this.terminate();
				return { value: undefined, done: true };
			}
		};
	}
}
