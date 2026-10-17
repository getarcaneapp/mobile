/** Port of `ListSortOrder` (Models.swift): name sort used by resource list filter sheets. */

export type ListSortOrder = 'ascending' | 'descending';

/** `String.localizedStandardCompare` (Finder-style, numeric-aware, case-insensitive). */
export function localizedStandardCompare(lhs: string, rhs: string): number {
	return lhs.localeCompare(rhs, undefined, { numeric: true, sensitivity: 'base' });
}

export const ListSortOrder = {
	allCases: ['ascending', 'descending'] as const,
	title: (order: ListSortOrder) => (order === 'ascending' ? 'A-Z' : 'Z-A'),
	systemImage: (order: ListSortOrder) => (order === 'ascending' ? 'arrow.up' : 'arrow.down'),
	/** Comparator for `Array.sort` matching `areInIncreasingOrder`. */
	compare: (order: ListSortOrder, lhs: string, rhs: string) =>
		order === 'ascending' ? localizedStandardCompare(lhs, rhs) : localizedStandardCompare(rhs, lhs)
} as const;
