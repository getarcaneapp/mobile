import { Fragment } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { MaterialListGroup } from '@/ui/material/list';

import {
	headerAccessorySectionID,
	type StableSectionedListProps
} from './stable-sectioned-list.types';
import { m3Type } from './type-scale';

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
						{section.title !== undefined ? (
							<View
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 8,
									paddingHorizontal: 16,
									paddingTop: 20,
									paddingBottom: 6
								}}
							>
								<Text
									accessibilityRole="header"
									style={[m3Type.titleSmall, { flex: 1, color: colors.secondaryLabel }]}
								>
									{section.title}
								</Text>
								{section.id === accessoryID && headerAccessory ? headerAccessory(section) : null}
							</View>
						) : (
							<View style={{ height: 12 }} />
						)}
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
