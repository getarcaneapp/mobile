import { FlashList } from '@shopify/flash-list';
import type { ReactElement, ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';

import {
	headerAccessorySectionID,
	stableItemKey,
	type StableListSection,
	type StableSectionedListProps
} from './stable-sectioned-list.types';
import { LoadsOnEndReachedContext } from './paginated-list.types';
import { m3Type } from './type-scale';

export function SectionHeader<
	SectionID extends string | number,
	Item extends { id: string | number }
>({ section, accessory }: { section: StableListSection<SectionID, Item>; accessory: ReactNode }) {
	if (section.title === undefined) return <View style={{ height: 12 }} />;
	return (
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
			{accessory}
		</View>
	);
}

type FlatRow<SectionID extends string | number, Item extends { id: string | number }> =
	| { kind: 'header'; key: string; section: StableListSection<SectionID, Item> }
	| { kind: 'item'; key: string; item: Item; isFirst: boolean; isLast: boolean };

export function flattenSections<
	SectionID extends string | number,
	Item extends { id: string | number }
>(sections: readonly StableListSection<SectionID, Item>[]): FlatRow<SectionID, Item>[] {
	const rows: FlatRow<SectionID, Item>[] = [];
	for (const section of sections) {
		if (section.items.length === 0) continue;
		rows.push({ kind: 'header', key: `section:${String(section.id)}`, section });
		section.items.forEach((item, index) => {
			rows.push({
				kind: 'item',
				key: `item:${String(section.id)}:${stableItemKey(item)}`,
				item,
				isFirst: index === 0,
				isLast: index === section.items.length - 1
			});
		});
	}
	return rows;
}

const groupRadius = 24;

export function GroupedRowSurface({
	isFirst,
	isLast,
	children
}: {
	isFirst: boolean;
	isLast: boolean;
	children: ReactNode;
}) {
	return (
		<View
			style={{
				marginHorizontal: 16,
				overflow: 'hidden',
				borderCurve: 'continuous',
				backgroundColor: colors.secondarySystemGroupedBackground,
				borderTopLeftRadius: isFirst ? groupRadius : 0,
				borderTopRightRadius: isFirst ? groupRadius : 0,
				borderBottomLeftRadius: isLast ? groupRadius : 0,
				borderBottomRightRadius: isLast ? groupRadius : 0
			}}
		>
			{children}
		</View>
	);
}

export function endReachedFooter(
	footer: ReactElement | null | undefined,
	onEndReached: (() => void) | undefined
): ReactElement | null | undefined {
	if (!footer || !onEndReached) return footer;
	return <LoadsOnEndReachedContext value>{footer}</LoadsOnEndReachedContext>;
}

export type VirtualizedSectionedListProps<
	SectionID extends string | number,
	Item extends { id: string | number }
> = StableSectionedListProps<SectionID, Item> & {
	header?: ReactElement | null;
	footer?: ReactElement | null;
	refreshControl?: ReactElement;
	contentContainerStyle?: StyleProp<ViewStyle>;
	extraData?: unknown;
	onEndReached?: () => void;
};

export function VirtualizedSectionedList<
	SectionID extends string | number,
	Item extends { id: string | number }
>({
	sections,
	renderRow,
	preferredHeaderAccessorySectionID,
	headerAccessory,
	header,
	footer,
	refreshControl,
	contentContainerStyle,
	extraData,
	onEndReached
}: VirtualizedSectionedListProps<SectionID, Item>) {
	const accessoryID = headerAccessorySectionID(sections, preferredHeaderAccessorySectionID);
	const rows = flattenSections(sections);
	return (
		<FlashList
			data={rows}
			extraData={extraData}
			keyExtractor={(row) => row.key}
			getItemType={(row) => row.kind}
			renderItem={({ item: row }) =>
				row.kind === 'header' ? (
					<SectionHeader
						section={row.section}
						accessory={
							row.section.id === accessoryID && headerAccessory
								? headerAccessory(row.section)
								: null
						}
					/>
				) : (
					<GroupedRowSurface isFirst={row.isFirst} isLast={row.isLast}>
						{renderRow(row.item)}
					</GroupedRowSurface>
				)
			}
			ListHeaderComponent={header}
			ListFooterComponent={endReachedFooter(footer, onEndReached)}
			refreshControl={refreshControl}
			onEndReached={onEndReached}
			keyboardShouldPersistTaps="handled"
			style={{ backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={contentContainerStyle ?? { paddingBottom: 24 }}
		/>
	);
}
