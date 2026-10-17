/**
 * Android rendering of `JobsView` (JobsView.swift): Material 3 list linking
 * to the jobs list and the schedule settings.
 */
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialListItem } from '@/ui/material/list';

import { useJobsNavigation } from './jobs-routes';
import type { JobsScreenProps } from './jobs-screen.types';

export function JobsScreen({ environmentID, allEnvironments }: JobsScreenProps) {
	const navigation = useJobsNavigation();
	const accent = useAccentColor();
	const chevron = <Icon name="chevron.right" size={20} color={colors.secondaryLabel} />;
	return (
		<>
			<Stack.Screen options={{ title: 'Jobs' }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<View style={{ height: 12 }} />
				<MaterialListGroup>
					<MaterialListItem
						headline="Jobs"
						icon="play.square.stack"
						iconColor={accent}
						trailing={chevron}
						onPress={() => navigation.openList(environmentID, allEnvironments)}
					/>
					<MaterialListItem
						headline="Schedules"
						icon="calendar.badge.clock"
						iconColor={accent}
						trailing={chevron}
						onPress={() =>
							allEnvironments
								? navigation.openScheduleEnvironments()
								: navigation.openSchedules(environmentID)
						}
					/>
				</MaterialListGroup>
			</ScrollView>
		</>
	);
}
