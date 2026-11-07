export const maxDetailMessages = 500;
export const maxActivityDetails = 20;

export function capMessages<T>(messages: T[]): T[] {
	return messages.length > maxDetailMessages ? messages.slice(-maxDetailMessages) : messages;
}

export function addDetail<T>(
	details: Readonly<Record<string, T>>,
	key: string,
	detail: T
): Record<string, T> {
	const keys = Object.keys(details).filter((existing) => existing !== key);
	const kept = keys.slice(Math.max(0, keys.length - (maxActivityDetails - 1)));
	const next: Record<string, T> = {};
	for (const existing of kept) {
		const value = details[existing];
		if (value !== undefined) next[existing] = value;
	}
	next[key] = detail;
	return next;
}
