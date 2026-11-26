import {
	Button,
	ContentUnavailableView,
	HStack,
	List,
	Section,
	Spacer,
	TextField,
	ZStack
} from '@expo/ui/swift-ui';
import {
	accessibilityHint,
	autocorrectionDisabled,
	buttonStyle,
	contentShape,
	foregroundStyle,
	listSectionSpacing,
	listStyle,
	shapes,
	submitLabel
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { systemColors } from '@/theme/colors';
import { Image } from '@/ui/components/swiftui-image';
import { Host } from '@/ui/host';
import { DisclosureChevron } from '@/ui/settings-row';

import { serverSettingsTitle } from './more-groups';
import { DestinationRowGroup, LinkRow, TileSection } from './more-parts';
import { UserAccountLabel } from './user-account-label';
import { useMoreDestinations } from './use-more-destinations';

export function MoreScreen() {
	const router = useRouter();
	const [search, setSearch] = useState('');
	const { isSearching, tileGroups, searchResults, hasServerSettings, visibleTabs, open } =
		useMoreDestinations(search);

	return (
		<>
			<Stack.Screen options={{ title: 'More' }} />
			<Host style={{ flex: 1 }}>
				<ZStack>
					<List modifiers={[listStyle('insetGrouped'), listSectionSpacing(20)]}>
						<Section>
							<HStack spacing={8}>
								<Image
									systemName="magnifyingglass"
									modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
								/>
								<TextField
									placeholder="Search pages and settings"
									onTextChange={setSearch}
									modifiers={[autocorrectionDisabled(true), submitLabel('search')]}
								/>
							</HStack>
						</Section>
						{isSearching ? (
							searchResults.map((group) => (
								<DestinationRowGroup
									key={group.title}
									group={group}
									visibleTabs={visibleTabs}
									onOpen={open}
								/>
							))
						) : (
							<>
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
								{tileGroups.map((group) => (
									<TileSection key={group.title} group={group} onOpen={open} />
								))}
								<Section title="Settings">
									{hasServerSettings ? (
										<LinkRow
											title={serverSettingsTitle}
											symbol="server.rack"
											color={systemColors.indigo}
											onPress={() => router.push('/(tabs)/(more)/server-settings' as never)}
										/>
									) : null}
									<LinkRow
										title="App Settings"
										symbol="gearshape.fill"
										color={systemColors.gray}
										onPress={() => router.push('/(tabs)/(more)/app-settings')}
									/>
									<LinkRow
										title="Preview Features"
										symbol="flask.fill"
										color={systemColors.purple}
										onPress={() => router.push('/(tabs)/(more)/preview-features')}
									/>
								</Section>
								<Section>
									<LinkRow
										title="What's New"
										symbol="sparkles"
										color={systemColors.yellow}
										onPress={() => router.push('/whats-new')}
									/>
								</Section>
							</>
						)}
					</List>
					{isSearching && searchResults.length === 0 ? (
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
