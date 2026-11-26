import { useRootNavigationState, useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect, useRef } from 'react';
import { Keyboard, Platform, View } from 'react-native';

import { pinnableTabs, systemImage, tabBarTitle } from '@/core/app-tab';
import { Keys, storage, useStoredBool } from '@/core/storage';
import { LargeScreenNavigation } from '@/features/navigation/large-screen-navigation';
import { useNavigationLayout } from '@/features/navigation/use-navigation-layout';
import { useVisibleTabs } from '@/features/navigation/use-visible-tabs';
import { useAutomaticWhatsNewPresentation } from '@/features/whats-new/automatic-whats-new';
import { useAccentColor } from '@/theme/accent';
import { materialSymbol } from '@/ui/symbols';

function TabsNavigationObserver() {
	useAutomaticWhatsNewPresentation();

	const segments = useSegments() as string[];
	const selectedGroup = segments[1];
	useEffect(() => {
		const id = selectedGroup?.match(/^\((.+)\)$/)?.[1];
		if (id) storage.set(Keys.lastSelectedTabID, id === 'more' ? 'settings' : id);
	}, [selectedGroup]);

	const stackDepth = focusedDepth(useRootNavigationState());
	const previousDepth = useRef(stackDepth);
	useEffect(() => {
		if (Platform.OS === 'android' && stackDepth < previousDepth.current) Keyboard.dismiss();
		previousDepth.current = stackDepth;
	}, [stackDepth]);

	return null;
}

export default function TabsLayout() {
	const accent = useAccentColor();
	const [showTabLabels] = useStoredBool(Keys.showTabLabels, false);
	const { visible } = useVisibleTabs();
	const layout = useNavigationLayout();

	return (
		<View style={{ flex: 1, flexDirection: 'row' }}>
			<TabsNavigationObserver />
			<LargeScreenNavigation layout={layout} />
			<View style={{ flex: 1 }}>
				<NativeTabs
					hidden={layout !== 'tabBar'}
					tintColor={accent}
					minimizeBehavior="never"
					labelVisibilityMode={showTabLabels ? 'labeled' : 'unlabeled'}
				>
					{[...visible, ...pinnableTabs.filter((tab) => !visible.includes(tab))].map((tab) => {
						return (
							<NativeTabs.Trigger
								key={tab}
								name={`(${tab})`}
								hidden={!visible.includes(tab)}
								accessibilityLabel={tabBarTitle(tab)}
							>
								<NativeTabs.Trigger.Label hidden={!showTabLabels}>
									{tabBarTitle(tab)}
								</NativeTabs.Trigger.Label>
								<NativeTabs.Trigger.Icon
									sf={systemImage[tab] as never}
									md={materialSymbol(systemImage[tab]) as never}
								/>
							</NativeTabs.Trigger>
						);
					})}
					<NativeTabs.Trigger name="(more)" role="search" accessibilityLabel="More">
						<NativeTabs.Trigger.Label hidden={!showTabLabels}>More</NativeTabs.Trigger.Label>
						<NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="more_horiz" />
					</NativeTabs.Trigger>
				</NativeTabs>
			</View>
		</View>
	);
}

type NavState = { index?: number; routes: { state?: NavState }[] } | undefined;

function focusedDepth(state: NavState): number {
	let depth = 0;
	for (let current = state; current;) {
		const index = current.index ?? current.routes.length - 1;
		depth += index;
		current = current.routes[index]?.state;
	}
	return depth;
}
