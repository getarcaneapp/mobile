import { Redirect, type Href } from 'expo-router';
import { View } from 'react-native';

import { AppTabIDs, type AppTab } from '@/core/app-tab';
import { Keys, storage } from '@/core/storage';
import { useClientManager } from '@/stores/client-manager';
import { useLaunchSplash } from '@/stores/launch-splash-store';
import { resolveTabs, useNavTabsStore } from '@/stores/nav-tabs-store';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';

function initialTabHref(): Href {
	const manager = useClientManager.getState();
	const available = new Set<AppTab>(AppTabIDs.filter(manager.canAccess));
	const visible = resolveTabs(useNavTabsStore.getState().pinnedTabs, available);
	const allowed: string[] = [...visible, 'settings'];
	const remember = storage.bool(Keys.rememberLastTab) ?? true;
	const saved = remember ? storage.string(Keys.lastSelectedTabID) : undefined;
	const selected = saved && allowed.includes(saved) ? saved : (allowed[0] ?? 'settings');
	return (
		selected === 'settings' ? '/(tabs)/(more)/more' : `/(tabs)/(${selected})/${selected}`
	) as Href;
}

export default function Index() {
	const authState = useClientManager((s) => s.authState);
	const showsLaunchSplash = useLaunchSplash((s) => s.isPresented);
	if (authState === 'authenticating') {
		return showsLaunchSplash ? null : (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView />
			</View>
		);
	}
	if (authState === 'authenticated') return <Redirect href={initialTabHref()} />;
	return <Redirect href="/login" />;
}
