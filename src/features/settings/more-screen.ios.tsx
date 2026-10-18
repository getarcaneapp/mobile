import {
	Button,
	ContentUnavailableView,
	HStack,
	List,
	Section,
	Spacer,
	Text,
	ZStack
} from '@expo/ui/swift-ui';
import { Host } from '@/ui/host';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHint,
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	listStyle,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { iconColor, systemImage, tabTitle } from '@/core/app-tab';
import { systemColors } from '@/theme/colors';
import { DisclosureChevron, SettingsRow } from '@/ui/settings-row';

import { UserAccountLabel } from './user-account-label';
import { useMoreDestinations } from './use-more-destinations';

export function MoreScreen() {
	const router = useRouter();
	const [search, setSearch] = useState('');
	const { filteredGroups, visibleTabs, open } = useMoreDestinations(search);

	return (
		<>
			<Stack.Screen
				options={{
					title: 'More',
					headerSearchBarOptions: {
						placeholder: 'Search destinations',
						onChangeText: (event) => setSearch(event.nativeEvent.text),
						onCancelButtonPress: () => setSearch('')
					}
				}}
			/>
			<Host style={{ flex: 1 }}>
				<ZStack>
					<List modifiers={[listStyle('insetGrouped')]}>
						{search.trim() === '' ? (
							<Section>
								<Button
									onPress={() => router.push('/(tabs)/(more)/profile')}
									modifiers={[buttonStyle('plain'), accessibilityHint('Opens profile')]}
								>
									<HStack modifiers={[contentShape(shapes.rectangle())]}>
										<UserAccountLabel />
										<Spacer />
										<DisclosureChevron />
									</HStack>
								</Button>
								<Button
									onPress={() => router.push('/(tabs)/(more)/app-settings')}
									modifiers={[buttonStyle('plain')]}
								>
									<HStack modifiers={[contentShape(shapes.rectangle())]}>
										<SettingsRow
											title="App Settings"
											systemImage="gearshape.fill"
											color={systemColors.gray}
										/>
										<Spacer />
										<DisclosureChevron />
									</HStack>
								</Button>
								<Button
									onPress={() => router.push('/(tabs)/(more)/preview-features')}
									modifiers={[buttonStyle('plain')]}
								>
									<HStack modifiers={[contentShape(shapes.rectangle())]}>
										<SettingsRow
											title="Preview Features"
											systemImage="flask.fill"
											color={systemColors.purple}
										/>
										<Spacer />
										<DisclosureChevron />
									</HStack>
								</Button>
								<Button
									onPress={() => router.push('/whats-new')}
									modifiers={[buttonStyle('plain')]}
								>
									<HStack modifiers={[contentShape(shapes.rectangle())]}>
										<SettingsRow
											title="What's New"
											systemImage="sparkles"
											color={systemColors.yellow}
											titleColor="primary"
										/>
										<Spacer />
										<DisclosureChevron />
									</HStack>
								</Button>
							</Section>
						) : null}
						{filteredGroups.map((group) => (
							<Section key={group.title} title={group.title}>
								{group.tabs.map((tab) => {
									const isTab = visibleTabs.has(tab);
									return (
										<Button
											key={tab}
											onPress={() => open(tab)}
											modifiers={[
												buttonStyle('plain'),
												accessibilityHint(
													isTab ? `Switches to the ${tabTitle[tab]} tab` : `Opens ${tabTitle[tab]}`
												)
											]}
										>
											<HStack
												modifiers={[
													frame({ maxWidth: Infinity, alignment: 'leading' }),
													contentShape(shapes.rectangle())
												]}
											>
												<SettingsRow
													title={tabTitle[tab]}
													systemImage={systemImage[tab]}
													color={systemColors[iconColor(tab)]}
												/>
												<Spacer />
												{isTab ? (
													<>
														<Text
															modifiers={[
																font({ textStyle: 'caption', weight: 'semibold' }),
																foregroundStyle({ type: 'hierarchical', style: 'secondary' })
															]}
														>
															Tab
														</Text>
														<Image
															systemName="arrow.turn.down.left"
															modifiers={[
																font({ textStyle: 'caption', weight: 'semibold' }),
																foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
															]}
														/>
													</>
												) : (
													<DisclosureChevron />
												)}
											</HStack>
										</Button>
									);
								})}
							</Section>
						))}
					</List>
					{filteredGroups.length === 0 ? (
						<ContentUnavailableView
							title={`No Results for “${search}”`}
							systemImage="magnifyingglass"
							description="Check the spelling or try a new search."
						/>
					) : null}
				</ZStack>
			</Host>
		</>
	);
}
