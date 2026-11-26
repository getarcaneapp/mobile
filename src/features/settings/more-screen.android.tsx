import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useClientManager } from '@/stores/client-manager';
import { colors, systemColors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialListItem, MaterialSectionHeader } from '@/ui/material/list';

import { serverSettingsTitle } from './more-groups';
import { DestinationRowGroup, TileSection } from './more-parts';
import { useMoreDestinations } from './use-more-destinations';

export function MoreScreen() {
	const router = useRouter();
	const [search, setSearch] = useState('');
	const { isSearching, tileGroups, searchResults, hasServerSettings, visibleTabs, open } =
		useMoreDestinations(search);
	const user = useClientManager((s) => s.currentUser);
	const displayName = !user ? 'Account' : user.displayName ? user.displayName : user.username;

	return (
		<>
			<Stack.Screen
				options={{
					title: 'More',
					headerSearchBarOptions: {
						placeholder: 'Search pages and settings',
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
				{isSearching ? (
					searchResults.length === 0 ? (
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
						searchResults.map((group) => (
							<DestinationRowGroup
								key={group.title}
								group={group}
								visibleTabs={visibleTabs}
								onOpen={open}
							/>
						))
					)
				) : (
					<>
						<MaterialListGroup>
							<MaterialListItem
								headline={displayName}
								supporting={user?.username ? `@${user.username}` : 'Profile'}
								icon="person.crop.circle"
								onPress={() => router.push('/(tabs)/(more)/profile')}
							/>
						</MaterialListGroup>
						{tileGroups.map((group) => (
							<TileSection key={group.title} group={group} onOpen={open} />
						))}
						<View>
							<MaterialSectionHeader title="Settings" />
							<MaterialListGroup>
								{hasServerSettings ? (
									<MaterialListItem
										headline={serverSettingsTitle}
										icon="server.rack"
										iconColor={systemColors.indigo}
										onPress={() => router.push('/(tabs)/(more)/server-settings' as never)}
									/>
								) : null}
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
							</MaterialListGroup>
						</View>
						<View style={{ marginTop: 16 }}>
							<MaterialListGroup>
								<MaterialListItem
									headline="What's New"
									icon="sparkles"
									iconColor={systemColors.yellow}
									onPress={() => router.push('/whats-new')}
								/>
							</MaterialListGroup>
						</View>
					</>
				)}
			</ScrollView>
		</>
	);
}
