import { Host } from '@/ui/host';
import { ContentUnavailableView, List, Section } from '@expo/ui/swift-ui';
import { listStyle, refreshable } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { JobsNavRow } from './jobs-nav-row';
import { useJobScheduleEnvironments } from './use-job-schedule-environments';

export function JobScheduleEnvironmentsScreen() {
	const model = useJobScheduleEnvironments();
	return (
		<>
			<Stack.Screen options={{ title: 'Schedules' }} />
			<Host style={{ flex: 1 }}>
				{model.showsEmpty ? (
					<ContentUnavailableView title="No Environments" systemImage="server.rack" />
				) : (
					<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
						<Section>
							{model.environments.map((environment) => (
								<JobsNavRow
									key={environment.id}
									title={environment.displayName}
									systemImage="server.rack"
									onPress={() => model.open(environment)}
								/>
							))}
						</Section>
					</List>
				)}
			</Host>
		</>
	);
}
