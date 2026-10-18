export type Transform<Value> = (value: Value) => Value;

export type CoalescedUpdates<Value> = {
	enqueue: (key: string, transform: Transform<Value>) => void;
	flush: () => void;
	drop: (keep: (key: string) => boolean) => void;
	clear: () => void;
};

export function coalescedUpdates<Value>(
	commit: (pending: ReadonlyMap<string, readonly Transform<Value>[]>) => void,
	delayMs: number
): CoalescedUpdates<Value> {
	const pending = new Map<string, Transform<Value>[]>();
	let timer: ReturnType<typeof setTimeout> | undefined;

	const cancel = () => {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
	};

	const flush = () => {
		cancel();
		if (pending.size === 0) return;
		const batch = new Map(pending);
		pending.clear();
		commit(batch);
	};

	return {
		enqueue: (key, transform) => {
			const list = pending.get(key);
			if (list) list.push(transform);
			else pending.set(key, [transform]);
			timer ??= setTimeout(flush, delayMs);
		},
		flush,
		drop: (keep) => {
			for (const key of pending.keys()) if (!keep(key)) pending.delete(key);
			if (pending.size === 0) cancel();
		},
		clear: () => {
			pending.clear();
			cancel();
		}
	};
}
