import { List } from '@expo/ui/swift-ui';
import { listSectionSpacing, listStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { Host } from '@/ui/host';

import { serverSettingsTitle } from './more-groups';
import { DestinationRowGroup } from './more-parts';
import { useServerSettingsDestinations } from './use-more-destinations';

export function ServerSettingsScreen() {
	const { groups, visibleTabs, open } = useServerSettingsDestinations();
	return (
		<>
			<Stack.Screen options={{ title: serverSettingsTitle, headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped'), listSectionSpacing(20)]}>
					{groups.map((group) => (
						<DestinationRowGroup
							key={group.title}
							group={group}
							visibleTabs={visibleTabs}
							onOpen={open}
						/>
					))}
				</List>
			</Host>
		</>
	);
}
