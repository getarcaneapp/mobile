import type { ReactNode } from 'react';

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
	estimatedItemSize?: number;
	preferredHeaderAccessorySectionID?: SectionID;
	headerAccessory?: (section: StableListSection<SectionID, Item>) => ReactNode;
};

export function stableItemKey(item: { id: string | number }): string {
	return String(item.id);
}

export function headerAccessorySectionID<
	SectionID extends string | number,
	Item extends { id: string | number }
>(sections: StableListSection<SectionID, Item>[], preferred?: SectionID): SectionID | undefined {
	if (preferred !== undefined && sections.some((s) => s.id === preferred && s.items.length > 0))
		return preferred;
	return sections.find((s) => s.items.length > 0)?.id;
}

export function bulkListSelection<Value>(
	selection: Value[],
	isSelecting: boolean
): Value[] | undefined {
	return isSelecting ? selection : undefined;
}
