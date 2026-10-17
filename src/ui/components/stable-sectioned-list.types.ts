import type { ReactNode } from 'react';

/** Port of `StableListSection`. */
export type StableListSection<
	SectionID extends string | number,
	Item extends { id: string | number }
> = {
	id: SectionID;
	title?: string;
	items: Item[];
};

export type StableSectionedListProps<
	SectionID extends string | number,
	Item extends { id: string | number }
> = {
	sections: StableListSection<SectionID, Item>[];
	renderRow: (item: Item) => ReactNode;
	/** The header accessory goes here when that section has rows, else the first non-empty one. */
	preferredHeaderAccessorySectionID?: SectionID;
	headerAccessory?: (section: StableListSection<SectionID, Item>) => ReactNode;
};

export function headerAccessorySectionID<
	SectionID extends string | number,
	Item extends { id: string | number }
>(sections: StableListSection<SectionID, Item>[], preferred?: SectionID): SectionID | undefined {
	if (preferred !== undefined && sections.some((s) => s.id === preferred && s.items.length > 0))
		return preferred;
	return sections.find((s) => s.items.length > 0)?.id;
}

/** Port of `BulkListSelection.binding`: the selection only while selecting. */
export function bulkListSelection<Value>(
	selection: Value[],
	isSelecting: boolean
): Value[] | undefined {
	return isSelecting ? selection : undefined;
}
