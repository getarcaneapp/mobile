import {
	Button,
	ContentUnavailableView,
	Grid,
	HStack,
	List,
	Section,
	Spacer,
	Text,
	VStack,
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
	lineLimit,
	listRowBackground,
	listRowInsets,
	listSectionSpacing,
	listStyle,
	padding,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { iconColor, systemImage, tabBarTitle, tabTitle, type AppTab } from '@/core/app-tab';
import { systemColors } from '@/theme/colors';
import { DashboardCardBackground } from '@/ui/components/swiftui-surfaces';
import { DisclosureChevron, SettingsRow } from '@/ui/settings-row';

import { tileRows } from './more-groups';

import { UserAccountLabel } from './user-account-label';
import { useMoreDestinations } from './use-more-destinations';

function DestinationTile({ tab, onPress }: { tab: AppTab | undefined; onPress: () => void }) {
	if (tab === undefined) return <Spacer modifiers={[frame({ maxWidth: Infinity })]} />;
	return (
		<Button
			onPress={onPress}
			modifiers={[buttonStyle('plain'), accessibilityHint(`Opens ${tabTitle[tab]}`)]}
		>
			<DashboardCardBackground>
				<VStack
					spacing={8}
					modifiers={[
						frame({ maxWidth: Infinity, minHeight: 56 }),
						padding({ vertical: 14, horizontal: 6 }),
						contentShape(shapes.rectangle())
					]}
				>
					<Image
						systemName={systemImage[tab] as SFSymbol}
						modifiers={[
							font({ textStyle: 'title2' }),
							foregroundStyle(systemColors[iconColor(tab)]),
							frame({ height: 30 })
						]}
					/>
					<Text modifiers={[font({ textStyle: 'footnote', weight: 'medium' }), lineLimit(1)]}>
						{tabBarTitle(tab)}
					</Text>
				</VStack>
			</DashboardCardBackground>
		</Button>
	);
}

function AppRow({
	title,
	symbol,
	color,
	onPress
}: {
	title: string;
	symbol: string;
	color: string;
	onPress: () => void;
}) {
	return (
		<Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<SettingsRow title={title} systemImage={symbol} color={color} />
				<Spacer />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}

export function MoreScreen() {
	const router = useRouter();
	const [search, setSearch] = useState('');
	const { isSearching, tiles, filteredGroups, visibleTabs, open } = useMoreDestinations(search);

	return (
		<>
			<Stack.Screen
				options={{
					title: 'More',
					headerSearchBarOptions: {
						placeholder: 'Search destinations',
						hideWhenScrolling: false,
						onChangeText: (event) => setSearch(event.nativeEvent.text),
						onCancelButtonPress: () => setSearch('')
					}
				}}
			/>
			<Host style={{ flex: 1 }}>
				<ZStack>
					<List modifiers={[listStyle('insetGrouped'), listSectionSpacing(20)]}>
						{isSearching ? null : (
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
							</Section>
						)}
						{tiles.length > 0 ? (
							<Section>
								<Grid
									horizontalSpacing={10}
									verticalSpacing={10}
									modifiers={[
										frame({ maxWidth: Infinity }),
										listRowBackground('clear'),
										listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 })
									]}
								>
									{tileRows(tiles).map((row, rowIndex) => (
										<Grid.Row key={rowIndex}>
											{row.map((tab, index) => (
												<DestinationTile
													key={tab ?? `empty-${index}`}
													tab={tab}
													onPress={() => (tab ? open(tab) : undefined)}
												/>
											))}
										</Grid.Row>
									))}
								</Grid>
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
						{isSearching ? null : (
							<Section title="App">
								<AppRow
									title="App Settings"
									symbol="gearshape.fill"
									color={systemColors.gray}
									onPress={() => router.push('/(tabs)/(more)/app-settings')}
								/>
								<AppRow
									title="Preview Features"
									symbol="flask.fill"
									color={systemColors.purple}
									onPress={() => router.push('/(tabs)/(more)/preview-features')}
								/>
								<AppRow
									title="What's New"
									symbol="sparkles"
									color={systemColors.yellow}
									onPress={() => router.push('/whats-new')}
								/>
							</Section>
						)}
					</List>
					{isSearching && filteredGroups.length === 0 ? (
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
