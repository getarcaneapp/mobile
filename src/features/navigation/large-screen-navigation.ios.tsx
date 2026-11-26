import { Button, HStack, Label, List, Section } from '@expo/ui/swift-ui';
import {
	accessibilityHint,
	buttonStyle,
	contentShape,
	frame,
	listStyle,
	shapes,
	tag
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { systemImage, tabTitle } from '@/core/app-tab';
import { UserAccountLabel } from '@/features/settings/user-account-label';
import { colors } from '@/theme/colors';
import { Host } from '@/ui/host';

import { isSidebarItem, sidebarGroups } from './large-screen-destinations';
import type { LargeScreenNavigationProps } from './large-screen-navigation.types';
import { sidebarWidthFor } from './navigation-layout';
import { useLargeScreenNavigation } from './use-large-screen-navigation';

function Sidebar() {
	const router = useRouter();
	const { width } = useWindowDimensions();
	const { available, selection, openDestination } = useLargeScreenNavigation();
	const groups = useMemo(() => sidebarGroups(available), [available]);

	const onSelectionChange = (tags: (string | number)[]) => {
		const next = tags.find((value) => value !== selection);
		if (typeof next === 'string' && isSidebarItem(next)) openDestination(next);
	};

	return (
		<View style={{ width: sidebarWidthFor(width), flexDirection: 'row' }}>
			<Host style={{ flex: 1 }}>
				<List
					selection={selection ? [selection] : []}
					onSelectionChange={onSelectionChange}
					modifiers={[listStyle('sidebar')]}
				>
					<Section>
						<HStack modifiers={[tag('profile'), accessibilityHint('Opens profile')]}>
							<UserAccountLabel avatarSize={30} />
						</HStack>
					</Section>
					{groups.map((group) => (
						<Section key={group.title} title={group.title}>
							{group.tabs.map((tab) => (
								<Label
									key={tab}
									title={tabTitle[tab]}
									systemImage={systemImage[tab] as SFSymbol}
									modifiers={[tag(tab)]}
								/>
							))}
						</Section>
					))}
					<Section title="App">
						<Label
							title="App Settings"
							systemImage="gearshape.fill"
							modifiers={[tag('app-settings')]}
						/>
						<Label
							title="Preview Features"
							systemImage="flask.fill"
							modifiers={[tag('preview-features')]}
						/>
						<Button
							onPress={() => router.push('/whats-new')}
							modifiers={[buttonStyle('plain'), accessibilityHint("Opens What's New")]}
						>
							<HStack
								modifiers={[
									frame({ maxWidth: Infinity, alignment: 'leading' }),
									contentShape(shapes.rectangle())
								]}
							>
								<Label title="What's New" systemImage="sparkles" />
							</HStack>
						</Button>
					</Section>
				</List>
			</Host>
			<View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />
		</View>
	);
}

export function LargeScreenNavigation({ layout }: LargeScreenNavigationProps) {
	return layout === 'sidebar' ? <Sidebar /> : null;
}
