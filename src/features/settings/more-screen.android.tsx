import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { iconColor, systemImage, tabBarTitle, tabTitle, type AppTab } from '@/core/app-tab';
import { useClientManager } from '@/stores/client-manager';
import { colors, systemColors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialListItem, MaterialSectionHeader } from '@/ui/material/list';

import { tileRows } from './more-groups';
import { useMoreDestinations } from './use-more-destinations';

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
				<Text style={{ fontSize: 13, fontWeight: '500', color: colors.label }} numberOfLines={1}>
					{tabBarTitle(tab)}
				</Text>
			</Pressable>
		</View>
	);
}

export function MoreScreen() {
	const router = useRouter();
	const [search, setSearch] = useState('');
	const { isSearching, tiles, filteredGroups, visibleTabs, open } = useMoreDestinations(search);
	const user = useClientManager((s) => s.currentUser);
	const displayName = !user ? 'Account' : user.displayName ? user.displayName : user.username;

	return (
		<>
			<Stack.Screen
				options={{
					title: 'More',
					headerSearchBarOptions: {
						placeholder: 'Search destinations',
						onChangeText: (event) => setSearch(event.nativeEvent.text),
						onClose: () => setSearch('')
					}
				}}
			/>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingVertical: 12 }}
				keyboardShouldPersistTaps="handled"
			>
				{isSearching && filteredGroups.length === 0 ? (
					<View style={{ alignItems: 'center', padding: 48, gap: 8 }}>
						<Icon name="magnifyingglass" size={40} color={colors.secondaryLabel} />
						<Text
							style={{ fontSize: 20, color: colors.label }}
						>{`No results for “${search}”`}</Text>
						<Text style={{ color: colors.secondaryLabel }}>
							Check the spelling or try a new search.
						</Text>
					</View>
				) : (
					<>
						{isSearching ? null : (
							<MaterialListGroup>
								<MaterialListItem
									headline={displayName}
									supporting={user?.username ? `@${user.username}` : 'Profile'}
									icon="person.crop.circle"
									onPress={() => router.push('/(tabs)/(more)/profile')}
								/>
							</MaterialListGroup>
						)}
						{tiles.length > 0 ? (
							<View style={{ marginHorizontal: 16, marginTop: 16, gap: 10 }}>
								{tileRows(tiles).map((row, rowIndex) => (
									<View key={rowIndex} style={{ flexDirection: 'row', gap: 10 }}>
										{row.map((tab, index) => (
											<DestinationTile
												key={tab ?? `empty-${index}`}
												tab={tab}
												onPress={() => (tab ? open(tab) : undefined)}
											/>
										))}
									</View>
								))}
							</View>
						) : null}
						{filteredGroups.map((group) => (
							<View key={group.title}>
								<MaterialSectionHeader title={group.title} />
								<MaterialListGroup>
									{group.tabs.map((tab) => (
										<MaterialListItem
											key={tab}
											headline={tabTitle[tab]}
											icon={systemImage[tab]}
											iconColor={systemColors[iconColor(tab)]}
											trailingText={visibleTabs.has(tab) ? 'Tab' : undefined}
											onPress={() => open(tab)}
										/>
									))}
								</MaterialListGroup>
							</View>
						))}
						{isSearching ? null : (
							<View>
								<MaterialSectionHeader title="App" />
								<MaterialListGroup>
									<MaterialListItem
										headline="App Settings"
										icon="gearshape.fill"
										iconColor={systemColors.gray}
										onPress={() => router.push('/(tabs)/(more)/app-settings')}
									/>
									<MaterialListItem
										headline="Preview Features"
										icon="flask.fill"
										iconColor={systemColors.purple}
										onPress={() => router.push('/(tabs)/(more)/preview-features')}
									/>
									<MaterialListItem
										headline="What's New"
										icon="sparkles"
										iconColor={systemColors.yellow}
										onPress={() => router.push('/whats-new')}
									/>
								</MaterialListGroup>
							</View>
						)}
					</>
				)}
			</ScrollView>
		</>
	);
}
