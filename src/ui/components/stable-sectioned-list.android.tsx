import { Fragment } from 'react';
import { View } from 'react-native';

import { MaterialListGroup } from '@/ui/material/list';

import {
	headerAccessorySectionID,
	type StableSectionedListProps
} from './stable-sectioned-list.types';
import { SectionHeader } from './virtualized-sectioned-list';

export { bulkListSelection } from './stable-sectioned-list.types';

export function StableSectionedList<
	SectionID extends string | number,
	Item extends { id: string | number }
>({
	sections,
	renderRow,
	preferredHeaderAccessorySectionID,
	headerAccessory
}: StableSectionedListProps<SectionID, Item>) {
	const accessoryID = headerAccessorySectionID(sections, preferredHeaderAccessorySectionID);
	return (
		<>
			{sections
				.filter((section) => section.items.length > 0)
				.map((section) => (
					<View key={String(section.id)}>
						<SectionHeader
							section={section}
							accessory={
								section.id === accessoryID && headerAccessory ? headerAccessory(section) : null
							}
						/>
						<MaterialListGroup>
							{section.items.map((item) => (
								<Fragment key={String(item.id)}>{renderRow(item)}</Fragment>
							))}
						</MaterialListGroup>
					</View>
				))}
		</>
	);
}
