import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { withCleanup } from '@/core/with-cleanup';
import { CenteredMessage } from '@/features/containers/android-material';
import { useAccentColor } from '@/theme/accent';
import { colors, systemColors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialListItem } from '@/ui/material/list';

import { useJobScheduleEnvironments } from './use-job-schedule-environments';

export function JobScheduleEnvironmentsScreen() {
	const model = useJobScheduleEnvironments();
	const accent = useAccentColor();
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(
			() => model.refresh(),
			() => setRefreshing(false)
		);
	};

	return (
		<>
			<Stack.Screen options={{ title: 'Schedules' }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
						colors={[systemColors.blue]}
					/>
				}
			>
				{model.showsEmpty ? (
					<CenteredMessage icon="server.rack" title="No Environments" message="" />
				) : (
					<>
						<View style={{ height: 12 }} />
						<MaterialListGroup>
							{model.environments.map((environment) => (
								<MaterialListItem
									key={environment.id}
									headline={environment.displayName}
									icon="server.rack"
									iconColor={accent}
									trailing={<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />}
									onPress={() => model.open(environment)}
								/>
							))}
						</MaterialListGroup>
					</>
				)}
			</ScrollView>
		</>
	);
}
