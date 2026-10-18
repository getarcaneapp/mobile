export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
		return true;
	}
	if (Array.isArray(b)) return false;
	const ao = a as Record<string, unknown>;
	const bo = b as Record<string, unknown>;
	let defined = 0;
	for (const key in ao) {
		if (!Object.hasOwn(ao, key) || ao[key] === undefined) continue;
		defined += 1;
		if (!deepEqual(ao[key], bo[key])) return false;
	}
	for (const key in bo) {
		if (Object.hasOwn(bo, key) && bo[key] !== undefined) defined -= 1;
	}
	return defined === 0;
}
