import { useRootNavigationState, useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect, useMemo, useRef } from 'react';
import { Keyboard, Platform } from 'react-native';

import { AppTabIDs, pinnableTabs, systemImage, tabBarTitle, type AppTab } from '@/core/app-tab';
import { Keys, storage, useStoredBool } from '@/core/storage';
import { useAutomaticWhatsNewPresentation } from '@/features/whats-new/automatic-whats-new';
import { useClientManager } from '@/stores/client-manager';
import { resolveTabs, useNavTabsStore } from '@/stores/nav-tabs-store';
import { useAccentColor } from '@/theme/accent';
import { materialSymbol } from '@/ui/symbols';

export default function TabsLayout() {
	const accent = useAccentColor();
	useAutomaticWhatsNewPresentation();
	const [showTabLabels] = useStoredBool(Keys.showTabLabels, false);
	const pinned = useNavTabsStore((s) => s.pinnedTabs);
	const canAccess = useClientManager((s) => s.canAccess);
	useClientManager((s) => s.accessGeneration);

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

	const visible = useMemo(() => {
		const available = new Set<AppTab>(AppTabIDs.filter(canAccess));
		return resolveTabs(pinned, available);
	}, [pinned, canAccess]);

	return (
		<NativeTabs
			tintColor={accent}
			minimizeBehavior="never"
			labelVisibilityMode={showTabLabels ? 'labeled' : 'unlabeled'}
		>
			{[...visible, ...pinnableTabs.filter((tab) => !visible.includes(tab))].map((tab) => {
				return (
					<NativeTabs.Trigger key={tab} name={`(${tab})`} hidden={!visible.includes(tab)}>
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
			<NativeTabs.Trigger name="(more)">
				<NativeTabs.Trigger.Label hidden={!showTabLabels}>More</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="ellipsis.circle.fill" md="more_horiz" />
			</NativeTabs.Trigger>
		</NativeTabs>
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
