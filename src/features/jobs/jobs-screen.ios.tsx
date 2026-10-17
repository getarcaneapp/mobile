import { Host } from '@/ui/host';
import { List, Section } from '@expo/ui/swift-ui';
import { listStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { JobsNavRow } from './jobs-nav-row';
import { useJobsNavigation } from './jobs-routes';
import type { JobsScreenProps } from './jobs-screen.types';

export function JobsScreen({ environmentID, allEnvironments }: JobsScreenProps) {
	const navigation = useJobsNavigation();
	return (
		<>
			<Stack.Screen options={{ title: 'Jobs' }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					<Section>
						<JobsNavRow
							title="Jobs"
							systemImage="play.square.stack"
							onPress={() => navigation.openList(environmentID, allEnvironments)}
						/>
						<JobsNavRow
							title="Schedules"
							systemImage="calendar.badge.clock"
							onPress={() =>
								allEnvironments
									? navigation.openScheduleEnvironments()
									: navigation.openSchedules(environmentID)
							}
						/>
					</Section>
				</List>
			</Host>
		</>
	);
}
