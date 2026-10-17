/** Port of `NavigationCatalogLandingView(parent: .customize)` (NavigationCatalogLandingView.swift). */
import { Host } from '@/ui/host';
import { Button, ContentUnavailableView, HStack, List, Section, Spacer } from '@expo/ui/swift-ui';
import { listRowBackground, listStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import { iconColor, systemImage, tabTitle } from '@/core/app-tab';
import { systemColors } from '@/theme/colors';
import { DisclosureChevron, SettingsRow } from '@/ui/settings-row';

import { useNavigationCatalog } from './use-navigation-catalog';

const parent = 'customize';

export function CustomizeDestination() {
	const { children, open } = useNavigationCatalog(parent);
	return (
		<>
			<Stack.Screen options={{ title: tabTitle[parent] }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					{children.length === 0 ? (
						<ContentUnavailableView
							title="No Available Sections"
							systemImage={systemImage[parent] as SFSymbol}
							description="Your account does not have access to any sections here."
							modifiers={[listRowBackground('clear')]}
						/>
					) : (
						<Section title={tabTitle[parent]}>
							{children.map((child) => (
								<Button key={child} onPress={() => open(child)}>
									<HStack>
										<SettingsRow
											title={tabTitle[child]}
											systemImage={systemImage[child]}
											color={systemColors[iconColor(child)]}
										/>
										<Spacer />
										<DisclosureChevron />
									</HStack>
								</Button>
							))}
						</Section>
					)}
				</List>
			</Host>
		</>
	);
}
