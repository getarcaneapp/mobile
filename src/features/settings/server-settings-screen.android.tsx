import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { colors } from '@/theme/colors';

import { serverSettingsTitle } from './more-groups';
import { DestinationRowGroup } from './more-parts';
import { useServerSettingsDestinations } from './use-more-destinations';

export function ServerSettingsScreen() {
	const { groups, visibleTabs, open } = useServerSettingsDestinations();
	return (
		<>
			<Stack.Screen options={{ title: serverSettingsTitle }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingVertical: 12 }}
			>
				{groups.map((group) => (
					<DestinationRowGroup
						key={group.title}
						group={group}
						visibleTabs={visibleTabs}
						onOpen={open}
					/>
				))}
			</ScrollView>
		</>
	);
}
