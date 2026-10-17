import { Group, HStack, Section, Spacer, Text } from '@expo/ui/swift-ui';
import { font, tag } from '@expo/ui/swift-ui/modifiers';

import {
	headerAccessorySectionID,
	type StableSectionedListProps
} from './stable-sectioned-list.types';

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
					<Section
						key={String(section.id)}
						header={
							section.title !== undefined ? (
								<HStack spacing={8}>
									<Text modifiers={[font({ textStyle: 'footnote', weight: 'semibold' })]}>
										{section.title}
									</Text>
									<Spacer minLength={8} />
									{section.id === accessoryID && headerAccessory ? headerAccessory(section) : null}
								</HStack>
							) : undefined
						}
					>
						{section.items.map((item) => (
							<Group key={String(item.id)} modifiers={[tag(item.id)]}>
								{renderRow(item)}
							</Group>
						))}
					</Section>
				))}
		</>
	);
}
