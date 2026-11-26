import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { systemImage, tabBarTitle, type PinnableTab } from '@/core/app-tab';
import { Keys, useStoredBool } from '@/core/storage';
import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { Icon } from '@/ui/Icon';

import type { LargeScreenNavigationProps } from './large-screen-navigation.types';
import { railWidth } from './navigation-layout';
import { useLargeScreenNavigation } from './use-large-screen-navigation';

type RailDestination = { id: PinnableTab | 'more'; title: string; symbol: string };

function RailItem({
	destination,
	selected,
	labeled,
	onPress
}: {
	destination: RailDestination;
	selected: boolean;
	labeled: boolean;
	onPress: () => void;
}) {
	const accent = useAccentColor();
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="tab"
			accessibilityLabel={destination.title}
			accessibilityState={{ selected }}
			style={{ width: railWidth, alignItems: 'center', gap: 4, paddingVertical: 4 }}
		>
			<View
				style={{
					width: 56,
					height: 32,
					borderRadius: 16,
					overflow: 'hidden',
					backgroundColor: selected ? m3.secondaryContainer : 'transparent'
				}}
			>
				<Pressable
					onPress={onPress}
					accessible={false}
					android_ripple={{ color: colors.separator as string }}
					style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
				>
					<Icon
						name={destination.symbol}
						size={24}
						color={selected ? accent : colors.secondaryLabel}
					/>
				</Pressable>
			</View>
			{labeled ? (
				<Text
					numberOfLines={1}
					style={{
						fontSize: 12,
						lineHeight: 16,
						letterSpacing: 0.5,
						fontWeight: selected ? '700' : '500',
						color: selected ? colors.label : colors.secondaryLabel,
						maxWidth: railWidth - 8
					}}
				>
					{destination.title}
				</Text>
			) : null}
		</Pressable>
	);
}

function NavigationRail() {
	const insets = useSafeAreaInsets();
	const [showTabLabels] = useStoredBool(Keys.showTabLabels, false);
	const { visible, focusedGroup, selectTab } = useLargeScreenNavigation();
	const destinations: RailDestination[] = [
		...visible.map((tab) => ({ id: tab, title: tabBarTitle(tab), symbol: systemImage[tab] })),
		{ id: 'more', title: 'More', symbol: 'ellipsis.circle.fill' }
	];

	return (
		<View
			accessibilityRole="tablist"
			style={{
				width: railWidth + insets.left,
				paddingLeft: insets.left,
				paddingTop: insets.top + 44,
				paddingBottom: insets.bottom + 16,
				gap: 12,
				backgroundColor: colors.systemBackground
			}}
		>
			{destinations.map((destination) => (
				<RailItem
					key={destination.id}
					destination={destination}
					selected={focusedGroup === destination.id}
					labeled={showTabLabels}
					onPress={() => selectTab(destination.id)}
				/>
			))}
		</View>
	);
}

export function LargeScreenNavigation({ layout }: LargeScreenNavigationProps) {
	return layout === 'rail' ? <NavigationRail /> : null;
}
