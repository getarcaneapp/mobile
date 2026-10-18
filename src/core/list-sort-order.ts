export type ListSortOrder = 'ascending' | 'descending';

const standardCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const localizedStandardCompare: (lhs: string, rhs: string) => number =
	standardCollator.compare;

export const ListSortOrder = {
	allCases: ['ascending', 'descending'] as const,
	title: (order: ListSortOrder) => (order === 'ascending' ? 'A-Z' : 'Z-A'),
	systemImage: (order: ListSortOrder) => (order === 'ascending' ? 'arrow.up' : 'arrow.down'),
	compare: (order: ListSortOrder, lhs: string, rhs: string) =>
		order === 'ascending' ? localizedStandardCompare(lhs, rhs) : localizedStandardCompare(rhs, lhs)
} as const;
