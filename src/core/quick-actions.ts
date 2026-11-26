import * as QuickActions from 'expo-quick-actions';
import { Linking, Platform } from 'react-native';

import { PendingLaunchRoute } from '@/core/widgets/widget-links';
import { quickActionItems, quickActionTab } from '@/core/quick-action-items';
import { useClientManager } from '@/stores/client-manager';

const initialTab = quickActionTab(QuickActions.initial);
if (initialTab) PendingLaunchRoute.set(initialTab);

function publish() {
	const manager = useClientManager.getState();
	const items =
		manager.authState === 'authenticated'
			? quickActionItems(manager.canAccess, Platform.OS === 'ios')
			: [];
	void QuickActions.setItems(items).catch(() => {});
}

export function startQuickActions(): () => void {
	publish();
	const auth = useClientManager.subscribe((state, previous) => {
		if (state.authState !== previous.authState || state.canAccess !== previous.canAccess) publish();
	});
	const listener = QuickActions.addListener((action) => {
		const tab = quickActionTab(action);
		if (tab) void Linking.openURL(`arcane-mobile://open?tab=${tab}`).catch(() => {});
	});
	return () => {
		auth();
		listener.remove();
	};
}
