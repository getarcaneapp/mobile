import { Pressable, Text, View } from 'react-native';

import { iconColor, systemImage, tabBarTitle, tabTitle, type AppTab } from '@/core/app-tab';
import { colors, systemColors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialListItem, MaterialSectionHeader } from '@/ui/material/list';

import { tileRows, type MoreDestinationGroup } from './more-groups';

function DestinationTile({ tab, onPress }: { tab: AppTab | undefined; onPress: () => void }) {
	if (tab === undefined) return <View style={{ flex: 1 }} />;
	return (
		<View
			style={{
				flex: 1,
				borderRadius: 20,
				borderCurve: 'continuous',
				overflow: 'hidden',
				backgroundColor: colors.secondarySystemGroupedBackground
			}}
		>
			<Pressable
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={tabTitle[tab]}
				android_ripple={{ color: colors.separator as string }}
				style={{
					alignItems: 'center',
					justifyContent: 'center',
					gap: 8,
					minHeight: 88,
					paddingVertical: 14,
					paddingHorizontal: 6
				}}
			>
				<Icon name={systemImage[tab]} size={26} color={systemColors[iconColor(tab)]} />
				<Text
					style={{ fontSize: 13, fontWeight: '500', color: colors.label }}
					numberOfLines={1}
					adjustsFontSizeToFit
					minimumFontScale={0.8}
				>
					{tabBarTitle(tab)}
				</Text>
			</Pressable>
		</View>
	);
}

export function TileSection({
	group,
	onOpen
}: {
	group: MoreDestinationGroup;
	onOpen: (tab: AppTab) => void;
}) {
	return (
		<View>
			<MaterialSectionHeader title={group.title} />
			<View style={{ marginHorizontal: 16, gap: 10 }}>
				{tileRows(group.tabs).map((row, rowIndex) => (
					<View key={rowIndex} style={{ flexDirection: 'row', gap: 10 }}>
						{row.map((tab, index) => (
							<DestinationTile
								key={tab ?? `empty-${index}`}
								tab={tab}
								onPress={() => (tab ? onOpen(tab) : undefined)}
							/>
						))}
					</View>
				))}
			</View>
		</View>
	);
}

export function DestinationRowGroup({
	group,
	visibleTabs,
	onOpen
}: {
	group: MoreDestinationGroup;
	visibleTabs: ReadonlySet<AppTab>;
	onOpen: (tab: AppTab) => void;
}) {
	return (
		<View>
			<MaterialSectionHeader title={group.title} />
			<MaterialListGroup>
				{group.tabs.map((tab) => (
					<MaterialListItem
						key={tab}
						headline={tabTitle[tab]}
						icon={systemImage[tab]}
						iconColor={systemColors[iconColor(tab)]}
						trailingText={visibleTabs.has(tab) ? 'Tab' : undefined}
						onPress={() => onOpen(tab)}
					/>
				))}
			</MaterialListGroup>
		</View>
	);
}
