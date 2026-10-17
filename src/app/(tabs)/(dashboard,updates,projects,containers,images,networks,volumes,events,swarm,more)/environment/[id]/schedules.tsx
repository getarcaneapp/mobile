import { useLocalSearchParams } from 'expo-router';

import { JobScheduleConfigView } from '@/features/jobs/job-schedule-config-screen';

/** `JobScheduleConfigView(environmentID:environmentName:)`, pushed from Environment ▸ Automations. */
export default function Route() {
	const { id = '0', name } = useLocalSearchParams<{ id?: string; name?: string }>();
	return (
		<JobScheduleConfigView
			key={id}
			environmentID={id}
			environmentName={name === '' ? undefined : name}
		/>
	);
}
