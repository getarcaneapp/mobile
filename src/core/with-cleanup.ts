export async function withCleanup<T>(work: () => Promise<T>, cleanup: () => void): Promise<T> {
	try {
		return await work();
	} finally {
		cleanup();
	}
}

let keyCounter = 0;

export function nextInstanceKey(prefix: string): string {
	keyCounter += 1;
	return `${prefix}-${keyCounter}`;
}
