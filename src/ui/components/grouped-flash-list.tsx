import { FlashList } from '@shopify/flash-list';
import type { ReactElement, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';

import { endReachedFooter, GroupedRowSurface } from './virtualized-sectioned-list';

export type GroupedListEntry = {
	key: string;
	type: string;
	grouped?: { isFirst: boolean; isLast: boolean };
};

export function groupPosition(index: number, count: number) {
	return { isFirst: index === 0, isLast: index === count - 1 };
}

const defaultContentStyle = { paddingBottom: 24 };

export function GroupedFlashList<Entry extends GroupedListEntry>({
	data,
	renderEntry,
	header,
	footer,
	refreshControl,
	contentContainerStyle,
	extraData,
	onEndReached
}: {
	data: readonly Entry[];
	renderEntry: (entry: Entry) => ReactNode;
	header?: ReactElement | null;
	footer?: ReactElement | null;
	refreshControl?: ReactElement;
	contentContainerStyle?: StyleProp<ViewStyle>;
	extraData?: unknown;
	onEndReached?: () => void;
}) {
	return (
		<FlashList
			data={data}
			extraData={extraData}
			keyExtractor={(entry) => entry.key}
			getItemType={(entry) => entry.type}
			renderItem={({ item: entry }) =>
				entry.grouped ? (
					<GroupedRowSurface isFirst={entry.grouped.isFirst} isLast={entry.grouped.isLast}>
						{renderEntry(entry)}
					</GroupedRowSurface>
				) : (
					<>{renderEntry(entry)}</>
				)
			}
			ListHeaderComponent={header}
			ListFooterComponent={endReachedFooter(footer, onEndReached)}
			refreshControl={refreshControl}
			onEndReached={onEndReached}
			keyboardShouldPersistTaps="handled"
			style={{ backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={contentContainerStyle ?? defaultContentStyle}
		/>
	);
}
