import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { iconColor, systemImage, tabTitle } from '@/core/app-tab';
import { useClientManager } from '@/stores/client-manager';
import { colors, systemColors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialListItem, MaterialSectionHeader } from '@/ui/material/list';

import { useMoreDestinations } from './use-more-destinations';

export function MoreScreen() {
	const router = useRouter();
	const [search, setSearch] = useState('');
	const { filteredGroups, visibleTabs, open } = useMoreDestinations(search);
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
				{filteredGroups.length === 0 ? (
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
						{search.trim() === '' ? (
							<MaterialListGroup>
								<MaterialListItem
									headline={displayName}
									supporting={user?.username ? `@${user.username}` : 'Profile'}
									icon="person.crop.circle"
									onPress={() => router.push('/(tabs)/(more)/profile')}
								/>
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
					</>
				)}
			</ScrollView>
		</>
	);
}
