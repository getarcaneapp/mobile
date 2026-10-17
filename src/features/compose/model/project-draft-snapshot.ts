/**
 * Port of `ProjectDraftSnapshot` (Types/ProjectDraftSnapshot.swift) and
 * ProjectDraftSnapshot+Review.swift: review summaries, a line diff, and the
 * pre-save syntax check for the native Compose editor preview.
 */
import { parseAllDocuments } from 'yaml';

import { ComposeDocument } from './compose-document';
import { ComposeDocumentError } from './compose-errors';

export type ProjectDraftSnapshot = { compose: string; environment: string };

export const snapshotsEqual = (a: ProjectDraftSnapshot, b: ProjectDraftSnapshot) =>
	a.compose === b.compose && a.environment === b.environment;

/**
 * `CollectionDifference` offsets: indices removed from `before` and inserted
 * into `after`, from a minimal (Myers) edit script.
 */
export function lineDifference(
	before: readonly string[],
	after: readonly string[]
): { removed: number[]; inserted: number[] } {
	const n = before.length;
	const m = after.length;
	const max = n + m;
	const offset = max + 1;
	const trace: Int32Array[] = [];
	let v: Int32Array = new Int32Array(2 * max + 3);
	let found = false;
	for (let d = 0; d <= max && !found; d++) {
		trace.push(v.slice());
		for (let k = -d; k <= d; k += 2) {
			let x: number;
			if (k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)) x = v[offset + k + 1]!;
			else x = v[offset + k - 1]! + 1;
			let y = x - k;
			while (x < n && y < m && before[x] === after[y]) {
				x += 1;
				y += 1;
			}
			v[offset + k] = x;
			if (x >= n && y >= m) {
				found = true;
				break;
			}
		}
	}
	trace.push(v.slice());
	const removed: number[] = [];
	const inserted: number[] = [];
	let x = n;
	let y = m;
	for (let d = trace.length - 2; d > 0; d--) {
		v = trace[d]!;
		const k = x - y;
		const prevK = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? k + 1 : k - 1;
		const prevX = v[offset + prevK]!;
		const prevY = prevX - prevK;
		while (x > prevX && y > prevY) {
			x -= 1;
			y -= 1;
		}
		if (x === prevX) inserted.push(prevY);
		else removed.push(prevX);
		x = prevX;
		y = prevY;
	}
	return { removed: removed.sort((a, b) => a - b), inserted: inserted.sort((a, b) => a - b) };
}

export const ProjectDraftReview = {
	serviceChanges(draft: ProjectDraftSnapshot, original: ProjectDraftSnapshot): string[] {
		const after = ComposeDocument.tryParse(draft.compose);
		if (!after) return [];
		const before = ComposeDocument.tryParse(original.compose);
		const oldServices = new Set(before?.services ?? []);
		const newServices = new Set(after.services);
		return [...new Set([...oldServices, ...newServices])].sort().flatMap((service) => {
			if (!oldServices.has(service)) return [`Added service: ${service}`];
			if (!newServices.has(service)) return [`Removed service: ${service}`];
			const path = ['services', service];
			const keys = [...new Set([...(before?.keys(path) ?? []), ...after.keys(path)])].sort();
			return keys.flatMap((key) =>
				before?.rawValue([...path, key]) !== after.rawValue([...path, key])
					? [`${service}: ${key} changed`]
					: []
			);
		});
	},

	sourceDiff(draft: ProjectDraftSnapshot, original: ProjectDraftSnapshot): string {
		const before = original.compose.split('\n');
		const after = draft.compose.split('\n');
		const { removed, inserted } = lineDifference(before, after);
		return [
			...removed.map((index) => `- ${before[index]}`),
			...inserted.map((index) => `+ ${after[index]}`)
		].join('\n');
	},

	/** Checks syntax only: valid advanced YAML remains saveable through the raw editor. */
	validateSyntax(draft: ProjectDraftSnapshot) {
		const documents = parseAllDocuments(draft.compose, { uniqueKeys: false });
		const list = Array.isArray(documents) ? documents : [documents];
		if (list.some((document) => document.errors.length > 0)) {
			throw ComposeDocumentError.invalid('Invalid YAML. Correct the Compose source before saving.');
		}
	},

	canApplyLoadedContent(
		draft: ProjectDraftSnapshot,
		snapshot: ProjectDraftSnapshot,
		session: string,
		currentSession: string
	): boolean {
		return snapshotsEqual(draft, snapshot) && session === currentSession;
	}
};
